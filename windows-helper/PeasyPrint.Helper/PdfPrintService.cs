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
using PdfiumViewer;
using System.Drawing;
using System.Drawing.Imaging;

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
            using var pdfDocument = PdfDocument.Load(pdfStream);
            if (pdfDocument.PageCount <= 0)
                throw new InvalidOperationException("PDF has no pages");

            var fixedDoc = new FixedDocument();

            for (int i = 0; i < pdfDocument.PageCount; i++)
            {
                using var img = RenderPageToBitmap(pdfDocument, i, 300);
                var bitmapImage = ConvertToBitmapImage(img);

                var image = new Image { Source = bitmapImage, Stretch = Stretch.Uniform };
                var fixedPage = new FixedPage { Width = bitmapImage.PixelWidth, Height = bitmapImage.PixelHeight };
                fixedPage.Children.Add(image);

                var pageContent = new PageContent();
                ((System.Windows.Markup.IAddChild)pageContent).AddChild(fixedPage);
                fixedDoc.Pages.Add(pageContent);
            }

            return fixedDoc;
        }

        private static System.Drawing.Bitmap RenderPageToBitmap(PdfDocument doc, int pageIndex, int dpi)
        {
            var size = doc.PageSizes[pageIndex];
            var width = (int)Math.Round(size.Width * dpi / 72.0);
            var height = (int)Math.Round(size.Height * dpi / 72.0);
            var bitmap = new System.Drawing.Bitmap(width, height);
            bitmap.SetResolution(dpi, dpi);
            using (var g = System.Drawing.Graphics.FromImage(bitmap))
            {
                g.Clear(System.Drawing.Color.White);
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                doc.Render(pageIndex, g, new System.Drawing.Rectangle(0, 0, width, height), PdfRenderFlags.Annotations);
            }
            return bitmap;
        }

        private static BitmapImage ConvertToBitmapImage(System.Drawing.Bitmap bmp)
        {
            using var ms = new MemoryStream();
            bmp.Save(ms, ImageFormat.Png);
            ms.Position = 0;
            var bitmapImage = new BitmapImage();
            bitmapImage.BeginInit();
            bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
            bitmapImage.StreamSource = new MemoryStream(ms.ToArray());
            bitmapImage.EndInit();
            bitmapImage.Freeze();
            return bitmapImage;
        }
    }
}


