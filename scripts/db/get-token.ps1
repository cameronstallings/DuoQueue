# Reads the Supabase CLI's personal access token out of Windows Credential Manager.
#
# The CLI stores it there rather than in a file, so there is nothing to read off disk.
# This pulls it into memory so the sibling scripts can call the Management API without
# anyone pasting a token around or committing one.
$sig = @'
using System;
using System.Runtime.InteropServices;
public class CredMan {
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
}
'@
if (-not ("CredMan" -as [type])) { Add-Type -TypeDefinition $sig }

$ptr = [IntPtr]::Zero
if (-not [CredMan]::CredRead("Supabase CLI:supabase", 1, 0, [ref]$ptr)) {
  throw "No Supabase CLI credential found. Run 'npx supabase login' first."
}
$cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan+CREDENTIAL])
$bytes = New-Object byte[] $cred.CredentialBlobSize
[System.Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
[CredMan]::CredFree($ptr)
[System.Text.Encoding]::UTF8.GetString($bytes).Trim()
