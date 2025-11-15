using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PeasyPrint.Helper
{
    internal sealed class JobClient
    {
        private readonly HttpClient httpClient;
        private readonly Uri? apiBaseUri;

        public JobClient(HttpClient httpClient, Uri? apiBaseUri)
        {
            this.httpClient = httpClient;
            this.apiBaseUri = apiBaseUri;
        }

        public async Task<PrintRequest?> FetchJobAsync(string jobId, string? apiKey, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(jobId))
            {
                return null;
            }

            if (apiBaseUri == null)
            {
                throw new InvalidOperationException("API base is not set");
            }

            var requestUri = new Uri(apiBaseUri, $"/print-jobs/{Uri.EscapeDataString(jobId)}");
            using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }

            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                var snippet = body?.Length > 200 ? body.Substring(0, 200) + "…" : body;
                throw new InvalidOperationException($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {snippet}");
            }

            var text = await response.Content.ReadAsStringAsync();
            PrintJobDto? dto;
            try
            {
                dto = JsonSerializer.Deserialize<PrintJobDto>(text, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (JsonException je)
            {
                var preview = text?.Length > 200 ? text.Substring(0, 200) + "…" : text;
                throw new InvalidOperationException($"Invalid JSON from {requestUri}: {je.Message}. First bytes: {preview}");
            }

            if (dto == null)
            {
                throw new InvalidOperationException("Empty job response");
            }

            if (dto.FileUrl == null)
            {
                throw new InvalidOperationException("Job missing fileUrl");
            }

            return new PrintRequest
            {
                JobId = jobId,
                FileUrl = dto.FileUrl,
                NumberOfCopies = dto.Copies <= 0 ? 1 : dto.Copies,
                IsColor = dto.IsColor
            };
        }

        public async Task<PrintRequest?> FetchJobByUrlAsync(Uri jobUrl, string? apiKey, CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, jobUrl);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }

            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                var snippet = body?.Length > 200 ? body.Substring(0, 200) + "…" : body;
                throw new InvalidOperationException($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {snippet}");
            }

            var text = await response.Content.ReadAsStringAsync();
            PrintJobDto? dto;
            try
            {
                dto = JsonSerializer.Deserialize<PrintJobDto>(text, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (JsonException je)
            {
                var preview = text?.Length > 200 ? text.Substring(0, 200) + "…" : text;
                throw new InvalidOperationException($"Invalid JSON from {jobUrl}: {je.Message}. First bytes: {preview}");
            }

            if (dto == null || dto.FileUrl == null)
            {
                throw new InvalidOperationException("Invalid job response from jobUrl");
            }

            return new PrintRequest
            {
                JobUrl = jobUrl,
                FileUrl = dto.FileUrl,
                NumberOfCopies = dto.Copies <= 0 ? 1 : dto.Copies,
                IsColor = dto.IsColor
            };
        }
    }

    internal sealed class PrintJobDto
    {
        public Uri? FileUrl { get; set; }
        public int Copies { get; set; } = 1;
        public bool IsColor { get; set; } = true;
    }
}


