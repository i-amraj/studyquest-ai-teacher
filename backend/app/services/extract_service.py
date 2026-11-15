import fitz  # PyMuPDF

def extract_pdf_text(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    return "\n".join(pages).strip()

def pdf_page_count(data: bytes) -> int:
    return fitz.open(stream=data, filetype="pdf").page_count

def sniff_type(data: bytes) -> str | None:
    if data[:4] == b"%PDF":
        return "pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def compress_pdf_for_ai(data: bytes, max_bytes: int = 3 * 1024 * 1024, dpi: int = 110) -> bytes:
    """Bade/scanned PDF ko AI ke liye chhota karo: pages ko JPEG bana kar naya PDF.
    Text-wale PDF par istemal nahi hota (wahan text extraction hi kaafi hai)."""
    if len(data) <= max_bytes:
        return data
    try:
        import fitz
        src = fitz.open(stream=data, filetype="pdf")
        out = fitz.open()
        for page in src:
            pix = page.get_pixmap(dpi=dpi)
            img = pix.tobytes("jpeg", jpg_quality=68)
            np = out.new_page(width=page.rect.width, height=page.rect.height)
            np.insert_image(np.rect, stream=img)
        small = out.tobytes(garbage=4, deflate=True)
        return small if len(small) < len(data) else data
    except Exception:
        return data
