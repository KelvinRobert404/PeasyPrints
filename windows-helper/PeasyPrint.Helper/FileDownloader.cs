using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace PeasyPrint.Helper
{
    internal static class FileDownloader
    {
        private static readonly HttpClient SharedClient = new HttpClient();

        public static async Task<byte[]> DownloadAsync(Uri uri, CancellationToken cancellationToken = default)
        {
            using var response = await SharedClient.GetAsync(uri, HttpCompletionOption.ResponseContentRead, cancellationToken);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsByteArrayAsync(cancellationToken);
        }
    }
}



