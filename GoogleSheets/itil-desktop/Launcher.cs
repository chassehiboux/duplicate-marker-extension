using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

internal static class Launcher
{
    private static byte[] ReadFrame()
    {
        using (var reader = new BinaryReader(Console.OpenStandardInput()))
        {
            int size = reader.ReadInt32();
            if (size < 1 || size > 4096) throw new InvalidDataException();
            var payload = reader.ReadBytes(size);
            if (payload.Length != size) throw new EndOfStreamException();
            var frame = new byte[size + 4];
            Buffer.BlockCopy(BitConverter.GetBytes(size), 0, frame, 0, 4);
            Buffer.BlockCopy(payload, 0, frame, 4, size);
            return frame;
        }
    }

    private static void WriteError(string message)
    {
        var payload = Encoding.UTF8.GetBytes("{\"success\":false,\"error\":\"" + message + "\"}");
        var output = Console.OpenStandardOutput();
        var header = BitConverter.GetBytes(payload.Length);
        output.Write(header, 0, header.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
    }

    private static void Main()
    {
        using (var mutex = new Mutex(false, @"Local\DuplicateMarkerItilDesktop"))
        {
            bool acquired;
            try
            {
                acquired = mutex.WaitOne(0);
            }
            catch (AbandonedMutexException)
            {
                acquired = true;
            }
            if (!acquired)
            {
                WriteError("Локальная 1С:ITIL уже обрабатывает другую заявку. Повторите после её завершения.");
                return;
            }

            try
            {
                var frame = ReadFrame();
                var directory = AppDomain.CurrentDomain.BaseDirectory;
                var nodePath = File.ReadAllText(Path.Combine(directory, "node-path.txt")).Trim();
                var scriptPath = Path.Combine(directory, "host.cjs");
                using (var child = Process.Start(new ProcessStartInfo
                {
                    FileName = nodePath,
                    Arguments = "\"" + scriptPath + "\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true
                }))
                {
                    child.StandardInput.BaseStream.Write(frame, 0, frame.Length);
                    child.StandardInput.Close();
                    child.StandardOutput.BaseStream.CopyTo(Console.OpenStandardOutput());
                    child.WaitForExit();
                }
            }
            catch (Exception)
            {
                WriteError("Не удалось запустить локального помощника 1С:ITIL. Проверьте его установку.");
            }
            finally
            {
                mutex.ReleaseMutex();
            }
        }
    }
}
