import { readFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';

const knownOTC = [
  'paracetamol', 'ibuprofen', 'aspirin', 'cetirizine', 'loratadine',
  'omeprazole', 'ranitidine', 'loperamide', 'senokot', 'senna',
];

console.log('Parsing VMP XML...');
const xml = readFileSync('./nhs_dmd_extract/f_vmp2_3070526.xml', 'utf8');
const parsed = await parseStringPromise(xml);

const vmps = parsed.VIRTUAL_MED_PRODUCTS.VMPS?.[0].VMP || [];
console.log(`Total VMPs: ${vmps.length}`);

const otcMatches = vmps.filter(vmp => {
  const nm = (vmp.NM?.[0] || '').toLowerCase();
  return knownOTC.some(otc => nm.includes(otc));
}).slice(0, 20);

console.log(`\nFirst 20 OTC matches:`);
otcMatches.forEach(vmp => {
  console.log(`  - ${vmp.NM?.[0]}`);
});

console.log(`\nTotal OTC matches in file: ${vmps.filter(vmp => knownOTC.some(otc => (vmp.NM?.[0] || '').toLowerCase().includes(otc))).length}`);
