using System;
using System.IO;
using System.Printing;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using WinColor = Windows.UI.Color;
using System.Windows.Xps;
using System.Windows.Xps.Serialization;
using Windows.Data.Pdf;
using Windows.Storage.Streams;
using System.Runtime.InteropServices.WindowsRuntime;

// Requires Windows 10/11 with Windows Runtime PDF APIs available.
// This implementation loads the PDF via WinRT, renders each page to images,
// builds a FixedDocument, and prints it via XPS with the chosen PrintTicket.

namespace PeasyPrint.Helper
{
    internal sealed class PdfPrintService
    {
        public async Task PrintWithDialogAsync(Uri fileUrl, System.Windows.Controls.PrintDialog printDialog, PrintTicket ticket)
        {
            if (fileUrl == null)
            {
                throw new ArgumentNullException(nameof(fileUrl));
            }

            var pdfBytes = await FileDownloader.DownloadAsync(fileUrl);

            // Optional debug: save the downloaded PDF to disk if PEASYPRINT_SAVE_DOWNLOADED is set
            try
            {
                var saveFlag = Environment.GetEnvironmentVariable("PEASYPRINT_SAVE_DOWNLOADED");
                if (!string.IsNullOrWhiteSpace(saveFlag) && !string.Equals(saveFlag, "0", StringComparison.OrdinalIgnoreCase) && !string.Equals(saveFlag, "false", StringComparison.OrdinalIgnoreCase))
                {
                    var baseDir = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PeasyPrint", "debug");
                    Directory.CreateDirectory(baseDir);
                    var originalName = System.IO.Path.GetFileName(Uri.UnescapeDataString(fileUrl.AbsolutePath));
                    var safeName = string.IsNullOrWhiteSpace(originalName) ? "downloaded.pdf" : originalName;
                    var outPath = System.IO.Path.Combine(baseDir, $"{DateTime.Now:yyyyMMdd-HHmmss}-{safeName}");
                    System.IO.File.WriteAllBytes(outPath, pdfBytes);
                }
            }
            catch { }
            using var pdfStream = new MemoryStream(pdfBytes, writable: false);

            var fixedDoc = await RenderPdfToFixedDocumentAsync(pdfStream);

            // Respect ticket from dialog
            var queue = printDialog.PrintQueue;
            if (queue == null)
            {
                throw new InvalidOperationException("No print queue selected");
            }

			// Use the PrintDialog's PrintDocument to ensure driver UI (e.g., Microsoft Print to PDF Save As) is shown reliably
			printDialog.PrintTicket = ticket;
			var baseName = System.IO.Path.GetFileName(Uri.UnescapeDataString(fileUrl.AbsolutePath));
			var jobName = string.IsNullOrWhiteSpace(baseName) ? "PeasyPrint Job" : baseName;
			printDialog.PrintDocument(fixedDoc.DocumentPaginator, jobName);
        }

        private static async Task<FixedDocument> RenderPdfToFixedDocumentAsync(Stream pdfStream)
        {
            // Load PDF via WinRT API
            var ras = pdfStream.AsRandomAccessStream();
            var pdfDoc = await PdfDocument.LoadFromStreamAsync(ras);
            if (pdfDoc == null || pdfDoc.PageCount == 0)
                throw new InvalidOperationException("Unable to load PDF or PDF is empty");

            var fixedDoc = new FixedDocument();

            for (uint i = 0; i < pdfDoc.PageCount; i++)
            {
                using var page = pdfDoc.GetPage(i);
                var pageSize = page.Size;
                var width = Math.Max(1, (int)Math.Round(pageSize.Width));
                var height = Math.Max(1, (int)Math.Round(pageSize.Height));

                using var outStream = new InMemoryRandomAccessStream();
                var renderOptions = new PdfPageRenderOptions
                {
                    DestinationWidth = (uint)width,
                    DestinationHeight = (uint)height,
                    BackgroundColor = WinColor.FromArgb(255, 255, 255, 255)
                };
                await page.RenderToStreamAsync(outStream, renderOptions);

                using var managedStream = outStream.GetInputStreamAt(0).AsStreamForRead();
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.StreamSource = new MemoryStream(ReadAllBytes(managedStream));
                bitmap.EndInit();
                bitmap.Freeze();

                var image = new System.Windows.Controls.Image { Source = bitmap, Stretch = Stretch.Uniform };
                var fixedPage = new FixedPage { Width = bitmap.PixelWidth, Height = bitmap.PixelHeight };
                fixedPage.Children.Add(image);

                var pageContent = new PageContent();
                ((System.Windows.Markup.IAddChild)pageContent).AddChild(fixedPage);
                fixedDoc.Pages.Add(pageContent);
            }

            return fixedDoc;
        }

        private static byte[] ReadAllBytes(Stream stream)
        {
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            return ms.ToArray();
        }
    }
}


