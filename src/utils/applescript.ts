// ABOUTME: AppleScript bridge for executing scripts and communicating with Things3
// ABOUTME: Handles script execution, error handling, and response parsing

import { spawn } from 'child_process';
import { ErrorType, Things3Error } from '../types/index.js';

/**
 * Bridge class for executing AppleScript commands
 */
export class AppleScriptBridge {
  private readonly defaultTimeout = 30000; // 30 seconds

  /**
   * Execute an AppleScript and return the result
   * @param script The AppleScript code to execute
   * @returns The script output as a string
   */
  async execute(script: string): Promise<string> {
    return this.executeWithTimeout(script, this.defaultTimeout);
  }

  /**
   * Execute an AppleScript with a custom timeout
   * @param script The AppleScript code to execute
   * @param timeout Timeout in milliseconds
   * @returns The script output as a string
   */
  async executeWithTimeout(script: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const osascript = spawn('osascript', ['-e', script]);
      
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        osascript.kill();
        reject(new Things3Error(
          ErrorType.TIMEOUT,
          `AppleScript execution timed out after ${timeout}ms`
        ));
      }, timeout);

      osascript.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      osascript.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      osascript.on('close', (code) => {
        clearTimeout(timer);
        
        if (timedOut) return;

        if (code !== 0) {
          // Check for specific error conditions
          if (stderr.includes('Things3 is not running')) {
            reject(new Things3Error(
              ErrorType.THINGS_NOT_RUNNING,
              'Things3 is not running',
              { stderr }
            ));
          } else {
            reject(new Things3Error(
              ErrorType.APPLESCRIPT_ERROR,
              `AppleScript execution failed with code ${code}`,
              { stderr, stdout }
            ));
          }
        } else {
          resolve(stdout.trim());
        }
      });

      osascript.on('error', (error) => {
        clearTimeout(timer);
        reject(new Things3Error(
          ErrorType.APPLESCRIPT_ERROR,
          'Failed to execute AppleScript',
          error
        ));
      });
    });
  }

  /**
   * Escape a string for safe inclusion in AppleScript
   * @param str The string to escape
   * @returns The escaped string
   */
  escapeString(str: string): string {
    if (!str) return '';
    
    // Escape backslashes first, then quotes
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Parse AppleScript response into JavaScript objects
   * @param response The raw AppleScript response
   * @returns Parsed JavaScript object or array
   */
  parseResponse(response: string): unknown {
    if (!response) return null;

    // Handle simple responses
    if (response === 'true') return true;
    if (response === 'false') return false;
    if (response === 'missing value') return null;
    
    // Try to parse as number
    const num = Number(response);
    if (!isNaN(num) && response.trim() === num.toString()) {
      return num;
    }

    // Try to parse as JSON (if we format AppleScript output as JSON)
    try {
      return JSON.parse(response);
    } catch {
      // Not JSON, return as string
      return response;
    }
  }

  /**
   * Check if Things3 is running
   * @returns True if Things3 is running
   */
  async isThings3Running(): Promise<boolean> {
    try {
      const script = 'tell application "System Events" to (name of processes) contains "Things3"';
      const result = await this.execute(script);
      return result === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Launch Things3 if not already running.
   * Uses bundle ID as primary mechanism for post-reboot reliability (before the
   * AppleScript name→path cache is populated by the first launch).
   * Falls back to `open -b` shell command if the bundle-ID AppleScript also fails.
   * @returns True if Things3 was launched or already running
   */
  async ensureThings3Running(): Promise<boolean> {
    const isRunning = await this.isThings3Running();

    if (!isRunning) {
      // Primary: use bundle ID — works reliably after reboot before name cache warms up
      try {
        await this.execute('tell application id "com.culturedcode.ThingsMac" to activate');
        // Wait for Things3 to fully start
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch {
        // Bundle ID AppleScript failed — fall through to shell fallback
      }

      // Fallback: launch via `open -b` which always resolves via Launch Services
      try {
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('open', ['-b', 'com.culturedcode.ThingsMac']);
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`open -b com.culturedcode.ThingsMac exited with code ${code}`));
          });
          proc.on('error', reject);
        });
        // Wait for Things3 to fully start
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch (error) {
        throw new Things3Error(
          ErrorType.THINGS_NOT_RUNNING,
          'Failed to launch Things3',
          error
        );
      }
    }

    return true;
  }
}