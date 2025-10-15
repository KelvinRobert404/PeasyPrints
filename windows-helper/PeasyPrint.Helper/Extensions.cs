namespace PeasyPrint.Helper
{
    internal static class Extensions
    {
        public static bool HasValue(this System.Uri? uri)
        {
            return uri != null && !string.IsNullOrWhiteSpace(uri.AbsoluteUri);
        }
    }
}



