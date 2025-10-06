using System;
using System.Collections.Generic;
using System.Globalization;
using System.Printing;
using System.Windows;
using System.Windows.Controls;

namespace PeasyPrint.Helper
{
    public partial class App : System.Windows.Application
    {
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

                // If we received a jobId only, fetch job details from API
                if (!request.FileUrl.HasValue() && !string.IsNullOrWhiteSpace(request.JobId))
                {
                    var resolved = ResolveJob(request.JobId!);
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
                    pdfService.PrintWithDialogAsync(request.FileUrl!, printDialog, ticket).GetAwaiter().GetResult();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "PeasyPrint Helper", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                Shutdown(0);
            }
        }

        private static PrintRequest? ResolveJob(string jobId)
        {
            try
            {
                var apiBase = Environment.GetEnvironmentVariable("PEASYPRINT_API_BASE");
                var apiKey = Environment.GetEnvironmentVariable("PEASYPRINT_API_KEY");
                if (string.IsNullOrWhiteSpace(apiBase))
                {
                    throw new InvalidOperationException("PEASYPRINT_API_BASE not set");
                }
                var http = new System.Net.Http.HttpClient();
                var client = new JobClient(http, new Uri(apiBase));
                var resolved = client.FetchJobAsync(jobId, apiKey, CancellationToken.None).GetAwaiter().GetResult();
                return resolved;
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to fetch job: {ex.Message}", "PeasyPrint Helper", MessageBoxButton.OK, MessageBoxImage.Error);
                return null;
            }
        }

        private static (PrintDialog dialog, PrintTicket ticket) CreatePrefilledDialog(PrintRequest request, Settings settings)
        {
            var dialog = new PrintDialog();

            var ticket = dialog.PrintTicket ?? new PrintTicket();
            ticket.PageMediaSize = new PageMediaSize(PageMediaSizeName.ISOA4);
            ticket.CopyCount = request.NumberOfCopies;
            ticket.OutputColor = request.IsColor ? OutputColor.Color : OutputColor.Grayscale;
            dialog.PrintTicket = ticket;

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
            return (dialog, ticket);
        }
    }

    internal sealed class PrintRequest
    {
        public string? JobId { get; init; }
        public Uri? FileUrl { get; init; }
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


