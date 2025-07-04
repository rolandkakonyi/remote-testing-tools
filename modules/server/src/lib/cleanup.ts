import { readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export async function cleanupOrphanedDirectories(): Promise<void> {
  try {
    const tempDir = tmpdir();
    const entries = await readdir(tempDir);
    
    const geminiDirs = entries.filter(entry => entry.startsWith('gemini-'));
    
    if (geminiDirs.length === 0) {
      return;
    }
    
    console.log(`Found ${geminiDirs.length} orphaned gemini directories, cleaning up...`);
    
    const cleanupPromises = geminiDirs.map(async (dir) => {
      const dirPath = join(tempDir, dir);
      try {
        await rm(dirPath, { recursive: true, force: true });
        console.log(`Cleaned up orphaned directory: ${dirPath}`);
      } catch (error) {
        console.warn(`Failed to cleanup directory ${dirPath}:`, error);
      }
    });
    
    await Promise.allSettled(cleanupPromises);
    console.log('Orphaned directory cleanup completed');
  } catch (error) {
    console.warn('Failed to perform orphaned directory cleanup:', error);
  }
}