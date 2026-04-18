Add-Type -AssemblyName System.IO.Compression.FileSystem
$zf = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\AI\Documents\WorkBuddy\DuckAI-Export\DuckAI-Export-V1.1.zip')
$zf.Entries.FullName | Select-Object -First 20
$zf.Dispose()
