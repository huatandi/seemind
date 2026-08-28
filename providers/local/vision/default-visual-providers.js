import {PixelColorStateProvider} from './pixel-color-state-provider.js';
import {BrowserBarcodeProvider} from './browser-barcode-provider.js';
import {TransformersDetrProvider} from './transformers-detr-provider.js';

export function createDefaultVisualProviders({enableGeneralVision=false,detrOptions={}}={}){
  const providers=[
    new BrowserBarcodeProvider(),
    new PixelColorStateProvider(),
  ];
  if(enableGeneralVision)providers.push(new TransformersDetrProvider(detrOptions));
  return providers;
}
