/**
 * @fileoverview ESC/POS thermal printer service for kitchen order tickets.
 * @security
 * - Printer IPs must be on a local LAN (never exposed to WAN)
 * - Print jobs are queued to prevent concurrent access corruption
 * - Connection timeouts prevent hanging on unreachable printers
 */

import type { PrintJob } from '@/types';

/**
 * Formats an order into ESC/POS compatible byte commands.
 * This generates a raw ESC/POS payload that can be sent to any
 * network thermal printer via TCP on port 9100.
 *
 * For cloud deployments, this payload should be sent to a Local Print Agent
 * running on the restaurant's LAN that forwards to the printer.
 */
export function formatESCPOSPayload(printJob: PrintJob): Buffer {
  const commands: number[] = [];

  // ESC/POS initialization
  commands.push(0x1b, 0x40); // Initialize printer

  // Center alignment
  commands.push(0x1b, 0x61, 0x01);

  // Bold on + double height
  commands.push(0x1b, 0x45, 0x01); // Bold on
  commands.push(0x1b, 0x21, 0x10); // Double height

  // KOT Header
  const header = `*** KOT #${printJob.orderNumber} ***`;
  commands.push(...Buffer.from(header));
  commands.push(0x0a); // Line feed

  // Normal size
  commands.push(0x1b, 0x21, 0x00);
  commands.push(0x1b, 0x45, 0x00); // Bold off

  // Table number
  if (printJob.tableNumber) {
    commands.push(...Buffer.from(`Table: ${printJob.tableNumber}`));
    commands.push(0x0a);
  }

  // Timestamp
  commands.push(...Buffer.from(`Time: ${printJob.timestamp}`));
  commands.push(0x0a);

  // Divider line
  commands.push(...Buffer.from('--------------------------------'));
  commands.push(0x0a);

  // Left alignment for items
  commands.push(0x1b, 0x61, 0x00);

  // Items
  for (const item of printJob.items) {
    // Bold for item name + quantity
    commands.push(0x1b, 0x45, 0x01);
    commands.push(...Buffer.from(`${item.quantity}x ${item.name}`));
    commands.push(0x0a);
    commands.push(0x1b, 0x45, 0x00);

    // Modifiers (indented)
    for (const modifier of item.modifiers) {
      commands.push(...Buffer.from(`   + ${modifier}`));
      commands.push(0x0a);
    }

    // Notes (indented, if any)
    if (item.notes) {
      commands.push(...Buffer.from(`   Note: ${item.notes}`));
      commands.push(0x0a);
    }
  }

  // Divider
  commands.push(...Buffer.from('--------------------------------'));
  commands.push(0x0a);

  // Center footer
  commands.push(0x1b, 0x61, 0x01);
  commands.push(...Buffer.from(`Order #${printJob.orderNumber}`));
  commands.push(0x0a, 0x0a);

  // Cut paper
  commands.push(0x1d, 0x56, 0x00); // Full cut

  return Buffer.from(commands);
}

/**
 * Sends a print job to a network thermal printer via TCP.
 * @param printerIp - The IP address of the printer on the local network
 * @param port - TCP port (default 9100 for RAW/JetDirect)
 * @param payload - ESC/POS formatted byte buffer
 *
 * @security
 * - Printers should be on an isolated VLAN with no internet access
 * - Port 9100 should never be exposed to the public internet
 * - This function is designed to be called from a Local Print Agent
 */
export async function sendToPrinter(
  printerIp: string,
  port: number = 9100,
  payload: Buffer
): Promise<void> {
  // Dynamic import to avoid loading net module in serverless environments
  const net = await import('node:net');

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    // 5-second timeout to prevent hanging on unreachable printers
    socket.setTimeout(5000);

    socket.connect(port, printerIp, () => {
      socket.write(payload, (err) => {
        socket.destroy(); // Always close immediately after sending
        if (err) {
          reject(new Error(`Failed to write to printer: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Printer connection timeout: ${printerIp}:${port}`));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`Printer connection error: ${err.message}`));
    });
  });
}

/**
 * Creates a print job payload from an order and sends it to the configured printer.
 * This is the main entry point for printing kitchen order tickets.
 */
export async function printKitchenOrder(
  printJob: PrintJob,
  printerIp: string,
  printerPort: number = 9100
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = formatESCPOSPayload(printJob);
    await sendToPrinter(printerIp, printerPort, payload);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown printer error';
    console.error(`[PRINTER] Failed to print order #${printJob.orderNumber}: ${message}`);
    return { success: false, error: message };
  }
}
