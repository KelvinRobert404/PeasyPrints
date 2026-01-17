using System;
using System.Drawing.Printing;
using System.IO;
using System.Printing;
using System.Threading;
using System.Threading.Tasks;
using PdfiumViewer;

namespace PeasyPrint.Helper
{
    /// <summary>
    /// Prints PDFs using PdfiumViewer for lossless vector-quality output.
    /// Unlike WinRT rasterization, this preserves fonts and graphics at printer DPI.
    /// </summary>
    internal sealed class PdfPrintService
    {
        public async Task PrintWithDialogAsync(Uri fileUrl, System.Windows.Controls.PrintDialog wpfDialog, PrintTicket ticket, CancellationToken cancellationToken = default)
        {
            if (fileUrl == null)
            {
                throw new ArgumentNullException(nameof(fileUrl));
            }

            cancellationToken.ThrowIfCancellationRequested();

            var pdfBytes = await FileDownloader.DownloadAsync(fileUrl, cancellationToken);

            // Optional debug: save the downloaded PDF to disk if PEASYPRINT_SAVE_DOWNLOADED is set
            SaveDebugCopyIfRequested(fileUrl, pdfBytes);

            // Load PDF via PdfiumViewer (Google's PDFium engine)
            using var pdfStream = new MemoryStream(pdfBytes, writable: false);
            using var pdfDoc = PdfDocument.Load(pdfStream);

            // Create a PrintDocument that renders PDF vectors directly (no rasterization)
            // Use ShrinkToMargin to fit content within printer's hard margins and prevent clipping
            using var printDoc = pdfDoc.CreatePrintDocument(PdfPrintMode.ShrinkToMargin);

            // Apply settings from the WPF PrintDialog
            ConfigurePrintDocument(printDoc, wpfDialog, ticket);

            // Print!
            printDoc.Print();
        }

        private void ConfigurePrintDocument(PrintDocument printDoc, System.Windows.Controls.PrintDialog wpfDialog, PrintTicket ticket)
        {
            // Get printer name from WPF dialog
            if (wpfDialog.PrintQueue != null)
            {
                printDoc.PrinterSettings.PrinterName = wpfDialog.PrintQueue.FullName;
            }

            // Apply copy count
            if (ticket?.CopyCount.HasValue == true && ticket.CopyCount.Value > 0)
            {
                printDoc.PrinterSettings.Copies = (short)Math.Min(ticket.CopyCount.Value, short.MaxValue);
            }

            // Apply color mode
            if (ticket?.OutputColor.HasValue == true)
            {
                printDoc.DefaultPageSettings.Color = ticket.OutputColor.Value == OutputColor.Color;
            }

            // Set document name for print queue display
            printDoc.DocumentName = "PeasyPrint Job";
        }

        private static void SaveDebugCopyIfRequested(Uri fileUrl, byte[] pdfBytes)
        {
            try
            {
                var saveFlag = Environment.GetEnvironmentVariable("PEASYPRINT_SAVE_DOWNLOADED");
                if (!string.IsNullOrWhiteSpace(saveFlag) 
                    && !string.Equals(saveFlag, "0", StringComparison.OrdinalIgnoreCase) 
                    && !string.Equals(saveFlag, "false", StringComparison.OrdinalIgnoreCase))
                {
                    var baseDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), 
                        "PeasyPrint", 
                        "debug");
                    Directory.CreateDirectory(baseDir);
                    
                    var originalName = Path.GetFileName(Uri.UnescapeDataString(fileUrl.AbsolutePath));
                    var safeName = string.IsNullOrWhiteSpace(originalName) ? "downloaded.pdf" : originalName;
                    var outPath = Path.Combine(baseDir, $"{DateTime.Now:yyyyMMdd-HHmmss}-{safeName}");
                    
                    File.WriteAllBytes(outPath, pdfBytes);
                }
            }
            catch 
            { 
                // Debug save failed - not critical
            }
        }
    }
}
