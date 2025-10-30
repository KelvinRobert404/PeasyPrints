using System;
using System.Collections.Generic;
using System.Globalization;
using System.Printing;
using System.Windows;
using System.Windows.Controls;
using System.Threading;
using System.Threading.Tasks;

namespace PeasyPrint.Helper
{
    public partial class App : System.Windows.Application
    {
        private const string DEFAULT_API_BASE = "https://theswoop.club/api";
        protected override void OnStartup(StartupEventArgs e)
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;

            try
            {
                var args = Environment.GetCommandLineArgs();
                // Tray mode: keep running in system tray
                if (Array.Exists(args, a => string.Equals(a, "--tray", StringComparison.OrdinalIgnoreCase)))
                {
                    System.Windows.Forms.Application.EnableVisualStyles();
                    using var tray = new Tray();
                    System.Windows.Forms.Application.Run();
                    Shutdown(0);
                    return;
                }

                // Open settings UI if requested
                if (Array.Exists(args, a => a.StartsWith("peasyprint://settings", StringComparison.OrdinalIgnoreCase)))
                {
                    new SettingsWindow(SettingsStore.Load()).ShowDialog();
                    Shutdown(0);
                    return;
                }

                // If launched with no parameters, open Settings by default (standalone app UX)
                if (args.Length <= 1)
                {
                    new SettingsWindow(SettingsStore.Load()).ShowDialog();
                    Shutdown(0);
                    return;
                }

                var request = StartupArgumentsParser.Parse(args);

                if (request == null)
                {
                    // Fallback to Settings if arguments are not recognized
                    new SettingsWindow(SettingsStore.Load()).ShowDialog();
                    Shutdown(0);
                    return;
                }

                // Defer job resolution to async flow below so UI remains responsive

                // Hand over the rest of the flow to an async continuation so the UI can paint
                Dispatcher.InvokeAsync(async () =>
                {
                    try
                    {
                        // If we need to resolve job details
                        if (!request.FileUrl.HasValue() && (!string.IsNullOrWhiteSpace(request.JobId) || request.JobUrl != null))
                        {
                            ProgressWindow? pw = null;
                            try
                            {
                                pw = new ProgressWindow("Fetching print job…");
                                pw.Topmost = true;
                                pw.Show();
                            }
                            catch { }
                            var resolved = await ResolveJobAsync(request);
                            try { pw?.Close(); } catch { }
                            request = resolved ?? request;
                        }

                        var settings = SettingsStore.Load();

                        // Show dialog with defaults
                        var (printDialog, ticket) = CreatePrefilledDialog(request, settings);
                        var confirmed = printDialog.ShowDialog();
                        if (confirmed == true && request.FileUrl.HasValue())
                        {
                            // Render and print the PDF using the chosen printer
                            var pdfService = new PdfPrintService();
                            await pdfService.PrintWithDialogAsync(request.FileUrl!, printDialog, ticket);
                        }
                    }
                    catch (Exception ex2)
                    {
                        System.Windows.MessageBox.Show(ex2.Message, "PeasyPrint Helper", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                    finally
                    {
                        Shutdown(0);
                    }
                });
                return;
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show(ex.Message, "PeasyPrint Helper", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private static async Task<PrintRequest?> ResolveJobAsync(PrintRequest request)
        {
            try
            {
                var apiKey = Environment.GetEnvironmentVariable("PEASYPRINT_API_KEY");
                var http = new System.Net.Http.HttpClient();
                var client = new JobClient(http, null);

                // Highest priority: direct jobUrl
                if (request.JobUrl != null)
                {
                    return await client.FetchJobByUrlAsync(request.JobUrl, apiKey, CancellationToken.None);
                }

                // Build API base precedence: request.ApiBase -> settings override -> env -> default
                var settings = SettingsStore.Load();
                var apiBase = request.ApiBase
                    ?? settings.ApiBaseOverride
                    ?? Environment.GetEnvironmentVariable("PEASYPRINT_API_BASE")
                    ?? DEFAULT_API_BASE;

                var clientWithBase = new JobClient(http, new Uri(apiBase));
                return await clientWithBase.FetchJobAsync(request.JobId!, apiKey, CancellationToken.None);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Failed to fetch job: {ex.Message}", "PeasyPrint Helper", MessageBoxButton.OK, MessageBoxImage.Error);
                return null;
            }
        }

        private static (System.Windows.Controls.PrintDialog dialog, PrintTicket ticket) CreatePrefilledDialog(PrintRequest request, Settings settings)
        {
            var dialog = new System.Windows.Controls.PrintDialog();

            // Try to preselect printer by role first (color vs BW), then fallback to preferred substring
            var roleSubstring = request.IsColor ? settings.ColorPrinterNameSubstring : settings.BwPrinterNameSubstring;
            if (!string.IsNullOrWhiteSpace(roleSubstring) || !string.IsNullOrWhiteSpace(settings.PreferredPrinterNameSubstring))
            {
                try
                {
                    var server = new LocalPrintServer();
                    foreach (var queue in server.GetPrintQueues())
                    {
                        var target = roleSubstring ?? settings.PreferredPrinterNameSubstring;
                        if (!string.IsNullOrWhiteSpace(target) && queue.FullName.IndexOf(target, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            dialog.PrintQueue = queue;
                            break;
                        }
                    }
                }
                catch
                {
                    // ignore and leave default printer
                }
            }

            // IMPORTANT: Apply ticket AFTER selecting the target PrintQueue, otherwise defaults may override our values
            var desired = new PrintTicket
            {
                PageMediaSize = new PageMediaSize(PageMediaSizeName.ISOA4),
                CopyCount = Math.Max(1, request.NumberOfCopies),
                OutputColor = request.IsColor ? OutputColor.Color : OutputColor.Grayscale
            };

            PrintTicket finalTicket = desired;
            try
            {
                if (dialog.PrintQueue != null)
                {
                    var baseTicket = dialog.PrintQueue.UserPrintTicket ?? dialog.PrintQueue.DefaultPrintTicket;
                    var merge = dialog.PrintQueue.MergeAndValidatePrintTicket(baseTicket, desired);
                    var validated = merge.ValidatedPrintTicket;
                    if (validated != null)
                    {
                        finalTicket = validated;
                    }

                    // If the queue supports copies, ensure the value sticks
                    try
                    {
                        var caps = dialog.PrintQueue.GetPrintCapabilities(finalTicket);
                        if (caps?.MaxCopyCount.HasValue == true && caps.MaxCopyCount.Value >= desired.CopyCount)
                        {
                            finalTicket.CopyCount = desired.CopyCount;
                        }
                    }
                    catch { }
                }
            }
            catch { }

            dialog.PrintTicket = finalTicket;

            return (dialog, finalTicket);
        }
    }

    internal sealed class PrintRequest
    {
        public string? JobId { get; init; }
        public Uri? FileUrl { get; init; }
        public Uri? JobUrl { get; init; }
        public string? ApiBase { get; init; }
        public int NumberOfCopies { get; init; } = 1;
        public bool IsColor { get; init; } = true;
    }

    internal static class StartupArgumentsParser
    {
        public static PrintRequest? Parse(string[] args)
        {
            if (args == null || args.Length == 0)
            {
                return null;
            }

            // args[0] is exe path
            for (int i = 1; i < args.Length; i++)
            {
                var raw = args[i];
                if (string.IsNullOrWhiteSpace(raw))
                {
                    continue;
                }

                if (raw.StartsWith("peasyprint://", StringComparison.OrdinalIgnoreCase))
                {
                    return ParseCustomUrl(raw);
                }
            }

            // Simple CLI fallback: --file= --copies= --color=
            var dict = ToDictionary(args);

            if (!dict.ContainsKey("file") && !dict.ContainsKey("jobId"))
            {
                return null;
            }

            return new PrintRequest
            {
                JobId = dict.GetValueOrDefault("jobId"),
                FileUrl = dict.TryGetValue("file", out var file) && Uri.TryCreate(file, UriKind.Absolute, out var uri) ? uri : null,
                JobUrl = dict.TryGetValue("jobUrl", out var jobUrl) && Uri.TryCreate(jobUrl, UriKind.Absolute, out var jobUri) ? jobUri : null,
                ApiBase = dict.GetValueOrDefault("api"),
                NumberOfCopies = dict.TryGetValue("copies", out var copiesStr) && int.TryParse(copiesStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var copies) ? Math.Max(1, copies) : 1,
                IsColor = dict.TryGetValue("color", out var colorStr) ? !string.Equals(colorStr, "bw", StringComparison.OrdinalIgnoreCase) && !string.Equals(colorStr, "blackwhite", StringComparison.OrdinalIgnoreCase) && !string.Equals(colorStr, "grayscale", StringComparison.OrdinalIgnoreCase) ? bool.TryParse(colorStr, out var colorBool) ? colorBool : true : false : true
            };
        }

        private static PrintRequest ParseCustomUrl(string url)
        {
            var uri = new Uri(url);
            var query = ParseQuery(uri.Query);

            return new PrintRequest
            {
                JobId = query.GetValueOrDefault("jobId"),
                FileUrl = query.TryGetValue("file", out var file) && Uri.TryCreate(file, UriKind.Absolute, out var parsed) ? parsed : null,
                JobUrl = query.TryGetValue("jobUrl", out var jobUrl) && Uri.TryCreate(jobUrl, UriKind.Absolute, out var parsedJob) ? parsedJob : null,
                ApiBase = query.GetValueOrDefault("api"),
                NumberOfCopies = query.TryGetValue("copies", out var copiesStr) && int.TryParse(copiesStr, out var copies) ? Math.Max(1, copies) : 1,
                IsColor = query.TryGetValue("color", out var colorStr) ? !string.Equals(colorStr, "bw", StringComparison.OrdinalIgnoreCase) && !string.Equals(colorStr, "blackwhite", StringComparison.OrdinalIgnoreCase) && !string.Equals(colorStr, "grayscale", StringComparison.OrdinalIgnoreCase) ? bool.TryParse(colorStr, out var colorBool) ? colorBool : true : false : true
            };
        }

        private static Dictionary<string, string> ToDictionary(string[] args)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var arg in args)
            {
                var trimmed = arg.Trim();
                if (!trimmed.StartsWith("--", StringComparison.Ordinal))
                {
                    continue;
                }
                var idx = trimmed.IndexOf('=');
                if (idx <= 2 || idx >= trimmed.Length - 1)
                {
                    continue;
                }
                var key = trimmed.Substring(2, idx - 2);
                var val = trimmed.Substring(idx + 1);
                map[key] = val;
            }
            return map;
        }

        private static Dictionary<string, string> ParseQuery(string query)
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrEmpty(query))
            {
                return result;
            }
            var q = query.AsSpan();
            if (q.Length > 0 && q[0] == '?')
            {
                q = q[1..];
            }
            var str = q.ToString();
            var pairs = str.Split('&', StringSplitOptions.RemoveEmptyEntries);
            foreach (var pair in pairs)
            {
                var kv = pair.Split('=', 2);
                var key = Uri.UnescapeDataString(kv[0]);
                var val = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : string.Empty;
                result[key] = val;
            }
            return result;
        }
    }
}


