using System;
using System.IO;

namespace PeasyPrint.Helper
{
    /// <summary>
    /// Simple file logger for debugging. Logs to %LOCALAPPDATA%/PeasyPrint/logs/
    /// </summary>
    internal static class Logger
    {
        private static readonly string LogDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PeasyPrint",
            "logs");

        private static readonly object LockObj = new object();

        public static void Info(string message) => Log("INFO", message);
        public static void Warn(string message) => Log("WARN", message);
        public static void Error(string message) => Log("ERROR", message);
        public static void Error(string context, Exception ex) => Log("ERROR", $"{context}: {ex.Message}");

        private static void Log(string level, string message)
        {
            try
            {
                Directory.CreateDirectory(LogDir);
                var logFile = Path.Combine(LogDir, $"{DateTime.Now:yyyy-MM-dd}.log");
                var line = $"[{DateTime.Now:HH:mm:ss}] [{level}] {message}";
                
                lock (LockObj)
                {
                    File.AppendAllText(logFile, line + Environment.NewLine);
                }
            }
            catch
            {
                // Logging should never crash the app
            }
        }
    }
}
