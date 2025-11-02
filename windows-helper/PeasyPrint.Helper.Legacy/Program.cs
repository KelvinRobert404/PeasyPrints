using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Windows.Forms;

namespace PeasyPrint.Helper.Legacy
{
    internal static class Program
    {
        private const string DEFAULT_API_BASE = "https://theswoop.club/api";

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                // Tray not supported in legacy; accept and exit
                foreach (var a in args)
                {
                    if (string.Equals(a, "--tray", StringComparison.OrdinalIgnoreCase))
                    {
                        return 0;
                    }
                }

                // Settings shortcut
                foreach (var a in args)
                {
                    if (a.StartsWith("peasyprint://settings", StringComparison.OrdinalIgnoreCase))
                    {
                        var settings = SettingsStore.Load();
                        MessageBox.Show("Legacy helper uses Sumatra to show the Print dialog on Windows 7. Configure API base in settings.json.",
                            "PeasyPrint Helper (Legacy)", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        SettingsStore.Save(settings);
                        return 0;
                    }
                }

                var request = StartupArgumentsParser.Parse(args);
                if (request == null)
                {
                    MessageBox.Show("No print job specified.", "PeasyPrint Helper (Legacy)", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return 1;
                }

                // Resolve job if needed
                if (!request.FileUrl.HasValue && (!string.IsNullOrWhiteSpace(request.JobId) || request.JobUrl != null))
                {
                    request = ResolveJob(request);
                    if (request == null || !request.FileUrl.HasValue)
                    {
                        MessageBox.Show("Failed to resolve print job.", "PeasyPrint Helper (Legacy)", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return 2;
                    }
                }

                // Download file
                var fileUri = request.FileUrl;
                if (fileUri == null)
                {
                    MessageBox.Show("Missing file URL.", "PeasyPrint Helper (Legacy)", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 3;
                }

                var bytes = FileDownloader.Download(fileUri);
                var tempDir = Path.Combine(Path.GetTempPath(), "PeasyPrint");
                Directory.CreateDirectory(tempDir);
                var fileName = GetFileNameFromUrl(fileUri) ?? ("job-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds() + ".pdf");
                var localPath = Path.Combine(tempDir, fileName);
                File.WriteAllBytes(localPath, bytes);

                // Launch SumatraPDF with print dialog
                var sumatra = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SumatraPDF.exe");
                if (!File.Exists(sumatra))
                {
                    MessageBox.Show("SumatraPDF.exe not found next to the app. Reinstall the Legacy installer.", "PeasyPrint Helper (Legacy)", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 4;
                }

                var psi = new ProcessStartInfo
                {
                    FileName = sumatra,
                    Arguments = "-print-dialog \"" + localPath + "\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                Process.Start(psi);
                return 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "PeasyPrint Helper (Legacy)", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 10;
            }
        }

        private static string GetFileNameFromUrl(Uri url)
        {
            try
            {
                var last = Path.GetFileName(url.LocalPath);
                if (string.IsNullOrWhiteSpace(last)) return null;
                if (!last.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                {
                    last += ".pdf";
                }
                return Sanitize(last);
            }
            catch { return null; }
        }

        private static string Sanitize(string fileName)
        {
            foreach (var c in Path.GetInvalidFileNameChars())
            {
                fileName = fileName.Replace(c, '_');
            }
            return fileName;
        }

        private static PrintRequest ResolveJob(PrintRequest request)
        {
            try
            {
                ServicePointManager.SecurityProtocol |= (SecurityProtocolType)0x00000C00; // TLS 1.1 | TLS 1.2
            }
            catch { }

            var apiKey = Environment.GetEnvironmentVariable("PEASYPRINT_API_KEY");
            using (var http = new HttpClient())
            {
                if (request.JobUrl != null)
                {
                    var client = new JobClient(http, null);
                    return client.FetchJobByUrl(request.JobUrl, apiKey);
                }

                var settings = SettingsStore.Load();
                var apiBase = request.ApiBase
                    ?? settings.ApiBaseOverride
                    ?? Environment.GetEnvironmentVariable("PEASYPRINT_API_BASE")
                    ?? DEFAULT_API_BASE;

                var withBase = new JobClient(http, new Uri(apiBase));
                return withBase.FetchJob(request.JobId, apiKey);
            }
        }
    }

    internal sealed class PrintRequest
    {
        public string JobId { get; set; }
        public Uri FileUrl { get; set; }
        public Uri JobUrl { get; set; }
        public string ApiBase { get; set; }
        public int NumberOfCopies { get; set; } = 1;
        public bool IsColor { get; set; } = true;
    }

    internal static class StartupArgumentsParser
    {
        public static PrintRequest Parse(string[] args)
        {
            if (args == null || args.Length == 0) return null;
            for (int i = 0; i < args.Length; i++)
            {
                var raw = args[i];
                if (string.IsNullOrWhiteSpace(raw)) continue;
                if (raw.StartsWith("peasyprint://", StringComparison.OrdinalIgnoreCase))
                {
                    return ParseCustomUrl(raw);
                }
            }
            var dict = ToDictionary(args);
            if (!dict.ContainsKey("file") && !dict.ContainsKey("jobId")) return null;
            return new PrintRequest
            {
                JobId = dict.ContainsKey("jobId") ? dict["jobId"] : null,
                FileUrl = dict.ContainsKey("file") && Uri.TryCreate(dict["file"], UriKind.Absolute, out var f) ? f : null,
                JobUrl = dict.ContainsKey("jobUrl") && Uri.TryCreate(dict["jobUrl"], UriKind.Absolute, out var j) ? j : null,
                ApiBase = dict.ContainsKey("api") ? dict["api"] : null,
                NumberOfCopies = dict.ContainsKey("copies") && int.TryParse(dict["copies"], NumberStyles.Integer, CultureInfo.InvariantCulture, out var copies) ? Math.Max(1, copies) : 1,
                IsColor = dict.ContainsKey("color") ? ParseColor(dict["color"]) : true
            };
        }

        private static bool ParseColor(string s)
        {
            if (string.Equals(s, "bw", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s, "blackwhite", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s, "grayscale", StringComparison.OrdinalIgnoreCase)) return false;
            if (bool.TryParse(s, out var b)) return b;
            return true;
        }

        private static PrintRequest ParseCustomUrl(string url)
        {
            var uri = new Uri(url);
            var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
            return new PrintRequest
            {
                JobId = query["jobId"],
                FileUrl = Uri.TryCreate(query["file"], UriKind.Absolute, out var f) ? f : null,
                JobUrl = Uri.TryCreate(query["jobUrl"], UriKind.Absolute, out var j) ? j : null,
                ApiBase = query["api"],
                NumberOfCopies = int.TryParse(query["copies"], out var copies) ? Math.Max(1, copies) : 1,
                IsColor = ParseColor(query["color"]) 
            };
        }

        private static System.Collections.Generic.Dictionary<string, string> ToDictionary(string[] args)
        {
            var map = new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var arg in args)
            {
                var t = arg.Trim();
                if (!t.StartsWith("--", StringComparison.Ordinal)) continue;
                var idx = t.IndexOf('=');
                if (idx <= 2 || idx >= t.Length - 1) continue;
                var key = t.Substring(2, idx - 2);
                var val = t.Substring(idx + 1);
                map[key] = val;
            }
            return map;
        }
    }

    internal static class FileDownloader
    {
        public static byte[] Download(Uri uri)
        {
            using (var client = new System.Net.WebClient())
            {
                return client.DownloadData(uri);
            }
        }
    }

    internal sealed class JobClient
    {
        private readonly HttpClient httpClient;
        private readonly Uri apiBaseUri;

        public JobClient(HttpClient httpClient, Uri apiBaseUri)
        {
            this.httpClient = httpClient;
            this.apiBaseUri = apiBaseUri;
        }

        public PrintRequest FetchJob(string jobId, string apiKey)
        {
            var url = new Uri(apiBaseUri, "/print-jobs/" + Uri.EscapeDataString(jobId));
            var req = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            }
            var res = httpClient.Send(req);
            res.EnsureSuccessStatusCode();
            var json = res.Content.ReadAsStringAsync().Result;
            var dto = System.Text.Json.JsonSerializer.Deserialize<PrintJobDto>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (dto == null || dto.FileUrl == null) throw new InvalidOperationException("Invalid job response");
            return new PrintRequest { JobId = jobId, FileUrl = dto.FileUrl, NumberOfCopies = dto.Copies <= 0 ? 1 : dto.Copies, IsColor = dto.IsColor };
        }

        public PrintRequest FetchJobByUrl(Uri jobUrl, string apiKey)
        {
            var req = new HttpRequestMessage(HttpMethod.Get, jobUrl);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            }
            var res = httpClient.Send(req);
            res.EnsureSuccessStatusCode();
            var json = res.Content.ReadAsStringAsync().Result;
            var dto = System.Text.Json.JsonSerializer.Deserialize<PrintJobDto>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (dto == null || dto.FileUrl == null) throw new InvalidOperationException("Invalid job response");
            return new PrintRequest { JobUrl = jobUrl, FileUrl = dto.FileUrl, NumberOfCopies = dto.Copies <= 0 ? 1 : dto.Copies, IsColor = dto.IsColor };
        }
    }

    internal sealed class PrintJobDto
    {
        public Uri FileUrl { get; set; }
        public int Copies { get; set; } = 1;
        public bool IsColor { get; set; } = true;
    }

    internal sealed class Settings
    {
        public string PreferredPrinterNameSubstring { get; set; }
        public string BwPrinterNameSubstring { get; set; }
        public string ColorPrinterNameSubstring { get; set; }
        public System.Collections.Generic.List<string> AllowedDomains { get; set; } = new System.Collections.Generic.List<string>();
        public string ApiBaseOverride { get; set; }
    }

    internal static class SettingsStore
    {
        private static readonly string SettingsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PeasyPrint",
            "settings.json");

        public static Settings Load()
        {
            try
            {
                if (File.Exists(SettingsPath))
                {
                    var json = File.ReadAllText(SettingsPath);
                    var loaded = System.Text.Json.JsonSerializer.Deserialize<Settings>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    return loaded ?? new Settings();
                }
            }
            catch { }
            return new Settings();
        }

        public static void Save(Settings settings)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath));
            var json = System.Text.Json.JsonSerializer.Serialize(settings, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(SettingsPath, json);
        }
    }
}


