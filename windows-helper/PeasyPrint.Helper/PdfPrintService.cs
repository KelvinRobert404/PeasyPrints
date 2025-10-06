using System;
using System.IO;
using System.Printing;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Xps;
using System.Windows.Xps.Serialization;

// Requires Windows 10/11 with Windows Runtime PDF APIs available.
// This implementation loads the PDF via WinRT, renders each page to images,
// builds a FixedDocument, and prints it via XPS with the chosen PrintTicket.

namespace PeasyPrint.Helper
{
    internal sealed class PdfPrintService
    {
        public async Task PrintWithDialogAsync(Uri fileUrl, PrintDialog printDialog, PrintTicket ticket)
        {
            if (fileUrl == null)
            {
                throw new ArgumentNullException(nameof(fileUrl));
            }

            var pdfBytes = await FileDownloader.DownloadAsync(fileUrl);
            using var pdfStream = new MemoryStream(pdfBytes, writable: false);

            var fixedDoc = await RenderPdfToFixedDocumentAsync(pdfStream);

            // Respect ticket from dialog
            var queue = printDialog.PrintQueue;
            if (queue == null)
            {
                throw new InvalidOperationException("No print queue selected");
            }

            var writer = PrintQueue.CreateXpsDocumentWriter(queue);
            // Write using the ticket set on the dialog
            writer.Write(fixedDoc.DocumentPaginator, ticket);
        }

        private static async Task<FixedDocument> RenderPdfToFixedDocumentAsync(Stream pdfStream)
        {
            // Load PDF via WinRT API
            var ras = WindowsRuntimeStreamExtensions.AsRandomAccessStream(pdfStream);
            var pdfDoc = await Windows.Data.Pdf.PdfDocument.LoadFromStreamAsync(ras);
            if (pdfDoc == null || pdfDoc.PageCount == 0)
            {
                throw new InvalidOperationException("Unable to load PDF or PDF is empty");
            }

            var fixedDoc = new FixedDocument();

            for (uint i = 0; i < pdfDoc.PageCount; i++)
            {
                using var page = pdfDoc.GetPage(i);

                // Target render size: use page size at 300 DPI
                var pageSize = page.Size; // in points (1/96 inch for UWP)? We'll map to WPF units via 96 DPI
                var width = Math.Max(1, (int)Math.Round(pageSize.Width));
                var height = Math.Max(1, (int)Math.Round(pageSize.Height));

                using var outStream = new Windows.Storage.Streams.InMemoryRandomAccessStream();
                var renderOptions = new Windows.Data.Pdf.PdfPageRenderOptions
                {
                    DestinationWidth = (uint)width,
                    DestinationHeight = (uint)height,
                    BackgroundColor = Windows.UI.Color.FromArgb(255, 255, 255, 255)
                };
                await page.RenderToStreamAsync(outStream, renderOptions);

                // Convert WinRT stream to .NET stream
                using var managedStream = WindowsRuntimeStreamExtensions.AsStreamForRead(outStream.GetInputStreamAt(0));
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.StreamSource = new MemoryStream(ReadAllBytes(managedStream));
                bitmap.EndInit();
                bitmap.Freeze();

                var image = new Image
                {
                    Source = bitmap,
                    Stretch = Stretch.Uniform
                };

                var fixedPage = new FixedPage
                {
                    Width = bitmap.PixelWidth,
                    Height = bitmap.PixelHeight
                };
                fixedPage.Children.Add(image);

                var pageContent = new PageContent();
                ((IAddChild)pageContent).AddChild(fixedPage);
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


