export const bluePalette=['#2563eb','#1d4ed8','#0284c7','#60a5fa','#1e3a8a','#3b82f6'] as const;
export function blueTone(key:string):string {if((bluePalette as readonly string[]).includes(key))return key;let n=0;for(const c of key)n=(n*31+c.charCodeAt(0))>>>0;return bluePalette[n%bluePalette.length];}
