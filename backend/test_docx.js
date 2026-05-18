import JSZip from 'jszip';
import fs from 'fs';
const buf = fs.readFileSync('/app/templates/timbrado.docx');
JSZip.loadAsync(buf).then(async z => {
  const xml = await z.file('word/document.xml').async('string');
  const m = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  console.log('sectPr found:', !!m);
  console.log('has headerRef:', m && m[0].includes('headerReference'));
  console.log('sectPr:', m ? m[0].substring(0, 300) : 'NONE');

  // Build minimal test doc
  const docOpen = xml.match(/(<w:document[\s\S]*?>)/)[1];
  const xmlDecl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const sectPr = m ? m[0] : '';
  const newXml = xmlDecl + docOpen + '\n<w:body>\n<w:p><w:r><w:t>TEST</w:t></w:r></w:p>\n' + sectPr + '\n</w:body>\n</w:document>';
  z.file('word/document.xml', newXml);
  const out = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync('/app/test_out.docx', out);

  // Verify output
  const z2 = await JSZip.loadAsync(out);
  const d = await z2.file('word/document.xml').async('string');
  console.log('headerRef in output:', d.includes('headerReference'));
  console.log('header file preserved:', !!z2.file('word/header1.xml'));
  console.log('footer file preserved:', !!z2.file('word/footer1.xml'));
  console.log('image3 preserved:', !!z2.file('word/media/image3.png'));
  console.log('rels preserved:', !!z2.file('word/_rels/document.xml.rels'));
  const rels = await z2.file('word/_rels/document.xml.rels').async('string');
  console.log('rId7 in rels:', rels.includes('rId7'));
  console.log('Generated', out.length, 'bytes - OK');
}).catch(e => console.error('ERROR:', e.message));
