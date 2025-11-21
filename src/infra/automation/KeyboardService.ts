/**
 * Keyboard Automation Service
 * Sends keyboard input to Entropia Universe using hardware scan codes
 * Compatible with game's input system (AutoHotkey-style)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

/**
 * Scan codes for common keys (hardware-level, game-compatible)
 */
export const ScanCodes = {
  COMMA: 0x33,
  PERIOD: 0x34,
  SLASH: 0x35,
  ENTER: 0x1C,
  SPACE: 0x39,
  ESC: 0x01,
  F: 0x21,  // F key for interactions
  E: 0x12,  // E key for interactions
} as const;

export type ScanCode = typeof ScanCodes[keyof typeof ScanCodes];

/**
 * Send a keyboard input to Entropia Universe
 * Uses hardware scan codes for maximum compatibility
 */
export class KeyboardService {
  /**
   * Trigger the in-game location ping (comma key by default)
   */
  static async triggerLocationPing(): Promise<{ success: boolean; error?: string }> {
    return this.sendScanCode(ScanCodes.COMMA, 20); // Faster 20ms delay
  }

  /**
   * Send a raw scan code to the game
   * @param scanCode - Hardware scan code (e.g., ScanCodes.COMMA)
   * @param delayMs - Delay after key press (default: 50ms)
   */
  static async sendScanCode(
    scanCode: ScanCode,
    delayMs: number = 50
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[KeyboardService] 🎹 Sending scan code: 0x${scanCode.toString(16)}`);
    
    try {
      const scriptContent = this.generatePowerShellScript(scanCode, delayMs);
      const scriptPath = join(tmpdir(), `artemis-keypress-${Date.now()}.ps1`);

      try {
        await writeFile(scriptPath, scriptContent);
        console.log(`[KeyboardService] 📝 Script written to: ${scriptPath}`);
        
        const result = await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
        
        console.log(`[KeyboardService] ✅ Keypress executed`);
        console.log(`[KeyboardService] 📤 Output:`, result.stdout?.trim());
        
        if (result.stderr) {
          console.warn(`[KeyboardService] ⚠️ Stderr:`, result.stderr);
        }

        // Clean up temp file
        await unlink(scriptPath).catch(() => {});

        return { success: true };
      } catch (scriptError) {
        // Clean up temp file on error
        await unlink(scriptPath).catch(() => {});
        throw scriptError;
      }
    } catch (error) {
      console.error('[KeyboardService] ❌ Error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate PowerShell script for sending scan code
   */
  private static generatePowerShellScript(scanCode: ScanCode, delayMs: number): string {
    const scanCodeHex = `0x${scanCode.toString(16).toUpperCase()}`;
    
    return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public const int SW_RESTORE = 9;
  public const uint KEYEVENTF_KEYDOWN = 0x0000;
  public const uint KEYEVENTF_KEYUP = 0x0002;
  public const uint KEYEVENTF_SCANCODE = 0x0008;
}
"@

# Find Entropia process
$process = Get-Process | Where-Object {$_.ProcessName -eq "entropia" -or $_.MainWindowTitle -like "*Entropia Universe Client*"} | Select-Object -First 1

if ($process -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
  Write-Output "Found Entropia process: $($process.MainWindowTitle)"
  
  # Send scan code immediately - no activation delays
  [WinAPI]::keybd_event(0, ${scanCodeHex}, [WinAPI]::KEYEVENTF_SCANCODE -bor [WinAPI]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds ${delayMs}
  [WinAPI]::keybd_event(0, ${scanCodeHex}, [WinAPI]::KEYEVENTF_SCANCODE -bor [WinAPI]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
  
  Write-Output "Sent scan code ${scanCodeHex}"
} else {
  Write-Output "Could not find Entropia process"
}
`;
  }
}
