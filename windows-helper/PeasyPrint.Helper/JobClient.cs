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
        private readonly Uri apiBaseUri;

        public JobClient(HttpClient httpClient, Uri apiBaseUri)
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

            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(apiBaseUri, $"/print-jobs/{Uri.EscapeDataString(jobId)}"));
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }

            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var dto = await JsonSerializer.DeserializeAsync<PrintJobDto>(stream, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, cancellationToken);

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
    }

    internal sealed class PrintJobDto
    {
        public Uri? FileUrl { get; set; }
        public int Copies { get; set; } = 1;
        public bool IsColor { get; set; } = true;
    }
}


