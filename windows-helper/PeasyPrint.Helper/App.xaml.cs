using System;
using System.Collections.Generic;
using System.Globalization;
using System.Printing;
using System.Windows;
using System.Windows.Controls;

namespace PeasyPrint.Helper
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;

            try
            {
                var request = StartupArgumentsParser.Parse(Environment.GetCommandLineArgs());

                if (request == null)
                {
                    MessageBox.Show(
                        "No print parameters provided. Expected peasyprint:// or CLI args.",
                        "PeasyPrint Helper",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information);
                    Shutdown(0);
                    return;
                }

                ShowPrefilledPrintDialog(request);
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

        private static void ShowPrefilledPrintDialog(PrintRequest request)
        {
            var dialog = new PrintDialog();

            var ticket = dialog.PrintTicket ?? new PrintTicket();
            ticket.PageMediaSize = new PageMediaSize(PageMediaSizeName.ISOA4);
            ticket.CopyCount = request.NumberOfCopies;
            ticket.OutputColor = request.IsColor ? OutputColor.Color : OutputColor.Grayscale;
            dialog.PrintTicket = ticket;

            dialog.ShowDialog();
            // Intentionally not printing here; the user will click Print in the dialog.
            // Actual PDF rendering/printing will be wired in a later step.
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


