# Template execution contract — Example Report.docx

## Reference

- Retained reference: `C:\Users\chung\OneDrive\Desktop\AI-book-movie-tickets\outputs\artifact_work\Example Report.docx`
- SHA-256: `ec2fe7d38b1a4c9dd59aa9de7de01d0b2f87609151d3c770947b2cdc3314fb7b`
- Render evidence: `render-example-original/page-001.png` through `page-103.png`; 103 pages.
- Structural evidence: `Example Report.inventory.json`; 4 sections, 841 body paragraphs, 41 tables, 35 inline shapes, 64 package parts.

## Page system

- All four sections use portrait pages, 7560945 × 10693400 EMU (approximately A4).
- Margins: top 723900, bottom 723900, left 1080135, right 720090 EMU.
- Header/footer distances: 457200 EMU.
- Each section starts on a new page. Existing section geometry, header/footer links and page numbering are preserve-only.

## Typography and recurring components

- Reuse the source paragraph styles `normal`, `Heading 1`, `Heading 2`, `Heading 3`, `List Bullet`, captions and table styles without redefining them.
- Preserve the two cover-page patterns, decorative first-page frame, reviewer page, acknowledgements, declaration, table of contents and list-of-figures front matter.
- Preserve source page furniture, headers, footers, page-number fields, spacing, indents and section breaks.
- New report content must be authored only with styles already present in the reference; no generic document preset is allowed.

## Content flow

1. Two template cover pages.
2. Reviewer comments page.
3. Acknowledgements and declaration.
4. Table of contents and list of figures/tables.
5. Opening.
6. Chapter 1 — project overview.
7. Chapter 2 — system analysis and design.
8. Chapter 3 — implementation and testing.
9. Conclusion and references.

## Slot map

- Cover paragraphs 1–31: rewrite school/project/member/year placeholders; preserve positions and direct formatting.
- Reviewer page: preserve blank review space and signature block.
- Acknowledgements/declaration paragraphs 42–56: rewrite project-specific prose; preserve styles and paragraph count where practical.
- TOC/list pages paragraphs 60–68: preserve field containers and headings; set document fields to refresh on open.
- Body from the `LỜI MỞ ĐẦU` paragraph onward: replace the sample grading-system report with the CineX report. The sample body content, its screenshots, sample tables and sample references are editable/removable; the enclosing section system and style vocabulary are preserve-only.
- Headers/footers, styles, numbering, theme, relationships outside replaced body media, section properties and cover artwork: preserve-only.

## Package preservation

- Full part path/size/SHA inventory is recorded in `Example Report.inventory.json`.
- Preserve-only parts: `[Content_Types].xml`, theme, styles, numbering, settings (except `w:updateFields`), cover artwork, headers, footers, section properties, core relationships and font table.
- Editable parts: `word/document.xml`, body-scoped image relationships/media used by the removed sample body, core properties and settings update-field flag.
- Added body media may come only from the supplied SRS diagrams and must be inserted through standard Word image relationships.

## Fidelity gates

- Reference SHA must remain unchanged.
- Final document must retain four sections, A4 portrait geometry, cover appearance, reviewer page, headers/footers and source style names.
- No old “quản lý và đánh giá bài tập lập trình”, Judge0 or old project screenshots may remain in the final report body.
- No clipping, overlap, empty broken tables or orphan headings after render.
- TOC/page fields must be updated in Microsoft Word when available; otherwise `w:updateFields=true` is required.
