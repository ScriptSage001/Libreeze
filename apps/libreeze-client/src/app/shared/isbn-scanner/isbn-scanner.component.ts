import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var Quagga: any;

@Component({
  selector: 'app-isbn-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './isbn-scanner.component.html',
  styleUrls: ['./isbn-scanner.component.scss']
})
export class IsbnScannerComponent implements OnInit, OnDestroy {
  @ViewChild('scanner', { static: false }) scanner!: ElementRef;
  @Output() isbnDetected = new EventEmitter<string>();

  isScanning = false;
  lastResult: string | null = null;

  constructor() { }

  ngOnInit(): void {
    this.loadQuaggaScript();
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  public loadQuaggaScript(): void {
    if (typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1/dist/quagga.min.js';
      script.async = true;
      script.onload = () => {
        console.log('Quagga script loaded');
      };
      document.body.appendChild(script);
    }
  }

  public toggleScanner(): void {
    if (this.isScanning) {
      this.stopScanner();
    } else {
      this.startScanner();
    }
  }

  public startScanner(): void {
    this.isScanning = true;

    // Wait for the element to be available in the DOM
    setTimeout(() => {
      if (!this.scanner || typeof Quagga === 'undefined') {
        console.error('Scanner element or Quagga not available');
        this.isScanning = false;
        return;
      }

      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: this.scanner.nativeElement,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
          },
        },
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_128_reader"
          ]
        }
      }, (err: any) => {
        if (err) {
          console.error('Failed to initialize scanner', err);
          this.isScanning = false;
          return;
        }

        Quagga.start();

        Quagga.onDetected((result: any) => {
          const code = result.codeResult.code;
          if (code) {
            this.lastResult = code;
            this.isbnDetected.emit(code);
            this.stopScanner();
          }
        });
      });
    }, 500);
  }

  public stopScanner(): void {
    if (this.isScanning && typeof Quagga !== 'undefined') {
      Quagga.stop();
    }
    this.isScanning = false;
  }
}