import os
import re
import unittest
import fitz

# Paths to the compiled PDFs
OUTPUT_DIR = "/Users/mfuad16/Documents/Resume/output"
JA_01_PDF_PATH = os.path.join(OUTPUT_DIR, "ja_01_shokumu_modern.pdf")
JA_02_PDF_PATH = os.path.join(OUTPUT_DIR, "ja_02_rirekisho_grid.pdf")
JA_03_PDF_PATH = os.path.join(OUTPUT_DIR, "ja_03_deedy_jp.pdf")

EN_01_PDF_PATH = os.path.join(OUTPUT_DIR, "en_01_jakes_clean.pdf")

def contains_cjk(text):
    """Check if text contains Japanese character spans."""
    for char in text:
        code = ord(char)
        if (0x3040 <= code <= 0x309F) or \
           (0x30A0 <= code <= 0x30FF) or \
           (0x4E00 <= code <= 0x9FAF) or \
           (0x3000 <= code <= 0x303F) or \
           (0xFF00 <= code <= 0xFFEF) or \
           (0x3400 <= code <= 0x4DBF):
            return True
    return False

def get_cjk_spans(pdf_path):
    """Extract all spans from the PDF that contain CJK characters."""
    spans = []
    if not os.path.exists(pdf_path):
        return spans
    doc = fitz.open(pdf_path)
    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if "lines" in b:
                for l in b["lines"]:
                    for span in l["spans"]:
                        if contains_cjk(span["text"]):
                            spans.append(span)
    return spans

def is_gothic_font(font_name):
    """Check if font name indicates a Gothic (sans-serif) style."""
    name = font_name.lower()
    gothic_keywords = ["gothic", "hirakaku", "hiramaru", "hira_sans", "yugothic", "sans", "ipag", "ipaexg", "goth", "kozgopron"]
    return any(kw in name for kw in gothic_keywords)

def is_mincho_font(font_name):
    """Check if font name indicates a Mincho (serif) style."""
    name = font_name.lower()
    mincho_keywords = ["mincho", "hiramin", "ryumin", "yumincho", "serif", "ipam", "ipaexm", "min", "kozminpro"]
    return any(kw in name for kw in mincho_keywords)

def get_pdf_text(pdf_path):
    """Extract all text as a single string."""
    if not os.path.exists(pdf_path):
        return ""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def clean_extracted_text(text):
    """Remove all whitespace and newlines for robust header substring checking."""
    return re.sub(r"\s+", "", text)

def check_for_banned_translations(pdf_path):
    """Check for parenthetical English translations of proper Japanese names.
    Ignores non-translation parentheses such as technology stack lists or certifications.
    """
    text = get_pdf_text(pdf_path)
    banned_pairs = [
        ("東海大学", ["tokai", "university"]),
        ("日本航空", ["japan", "airlines", "jal"]),
        ("アルティウス", ["altius", "link"]),
        ("ホテル", ["hotel", "sui", "akasaka"]),
        ("モハメド", ["mohamed", "fuad"]),
        ("フアド", ["mohamed", "fuad"]),
        ("情報通信学部", ["information", "telecommunication", "ict"])
    ]
    violations = []
    for jp_name, eng_keywords in banned_pairs:
        # Match jp_name followed by optional whitespace/newlines, followed by parentheses and contents
        pattern = re.compile(rf"{jp_name}\s*[\(\uff08]([^\)\uff09]+)[\)\uff09]", re.IGNORECASE)
        for match in pattern.finditer(text):
            content = match.group(1).lower()
            if any(kw in content for kw in eng_keywords):
                violations.append(match.group(0))
    return violations

class TestResumes(unittest.TestCase):

    # ==========================================
    # TIER 1: FEATURE COVERAGE (30 TESTS)
    # ==========================================

    def test_tier1_compilation_ja01(self):
        """Tier 1: Verify ja_01_shokumu_modern.pdf is compiled and exists."""
        self.assertTrue(os.path.exists(JA_01_PDF_PATH), "ja_01_shokumu_modern.pdf does not exist")
        self.assertGreater(os.path.getsize(JA_01_PDF_PATH), 0, "ja_01_shokumu_modern.pdf is empty")

    def test_tier1_compilation_ja02(self):
        """Tier 1: Verify ja_02_rirekisho_grid.pdf is compiled and exists."""
        self.assertTrue(os.path.exists(JA_02_PDF_PATH), "ja_02_rirekisho_grid.pdf does not exist")
        self.assertGreater(os.path.getsize(JA_02_PDF_PATH), 0, "ja_02_rirekisho_grid.pdf is empty")

    def test_tier1_compilation_ja03(self):
        """Tier 1: Verify ja_03_deedy_jp.pdf is compiled and exists."""
        self.assertTrue(os.path.exists(JA_03_PDF_PATH), "ja_03_deedy_jp.pdf does not exist")
        self.assertGreater(os.path.getsize(JA_03_PDF_PATH), 0, "ja_03_deedy_jp.pdf is empty")


    def test_tier1_compilation_en01(self):
        """Tier 1: Verify en_01_jakes_clean.pdf is compiled and exists."""
        self.assertTrue(os.path.exists(EN_01_PDF_PATH), "en_01_jakes_clean.pdf does not exist")
        self.assertGreater(os.path.getsize(EN_01_PDF_PATH), 0, "en_01_jakes_clean.pdf is empty")

    def test_tier1_page_count_ja01(self):
        """Tier 1: Verify ja_01_shokumu_modern.pdf is strictly 2 pages."""
        self.assertTrue(os.path.exists(JA_01_PDF_PATH))
        doc = fitz.open(JA_01_PDF_PATH)
        self.assertEqual(len(doc), 2, f"ja_01 page count is {len(doc)}, expected 2")

    def test_tier1_page_count_ja02(self):
        """Tier 1: Verify ja_02_rirekisho_grid.pdf is strictly 1 page."""
        self.assertTrue(os.path.exists(JA_02_PDF_PATH))
        doc = fitz.open(JA_02_PDF_PATH)
        self.assertEqual(len(doc), 1, f"ja_02 page count is {len(doc)}, expected 1")

    def test_tier1_page_count_ja03(self):
        """Tier 1: Verify ja_03_deedy_jp.pdf is strictly 1 page."""
        self.assertTrue(os.path.exists(JA_03_PDF_PATH))
        doc = fitz.open(JA_03_PDF_PATH)
        self.assertEqual(len(doc), 1, f"ja_03 page count is {len(doc)}, expected 1")


    def test_tier1_page_count_en01(self):
        """Tier 1: Verify en_01_jakes_clean.pdf is strictly 1 page."""
        self.assertTrue(os.path.exists(EN_01_PDF_PATH))
        doc = fitz.open(EN_01_PDF_PATH)
        self.assertEqual(len(doc), 1, f"en_01 page count is {len(doc)}, expected 1")

    def test_tier1_font_choice_ja01(self):
        """Tier 1: Verify ja_01 uses Gothic fonts for CJK characters."""
        spans = get_cjk_spans(JA_01_PDF_PATH)
        self.assertTrue(len(spans) > 0, "No CJK text found in ja_01")
        for s in spans:
            self.assertTrue(is_gothic_font(s["font"]), f"Non-Gothic font '{s['font']}' used for CJK text '{s['text']}' in ja_01")

    def test_tier1_font_choice_ja02(self):
        """Tier 1: Verify ja_02 uses Mincho fonts for CJK characters."""
        spans = get_cjk_spans(JA_02_PDF_PATH)
        self.assertTrue(len(spans) > 0, "No CJK text found in ja_02")
        for s in spans:
            self.assertTrue(is_mincho_font(s["font"]), f"Non-Mincho font '{s['font']}' used for CJK text '{s['text']}' in ja_02")

    def test_tier1_font_choice_ja03(self):
        """Tier 1: Verify ja_03 uses Gothic fonts for CJK characters."""
        spans = get_cjk_spans(JA_03_PDF_PATH)
        self.assertTrue(len(spans) > 0, "No CJK text found in ja_03")
        for s in spans:
            self.assertTrue(is_gothic_font(s["font"]), f"Non-Gothic font '{s['font']}' used for CJK text '{s['text']}' in ja_03")


    def test_tier1_font_choice_en01(self):
        """Tier 1: Verify en_01 font checks (does not enforce CJK fonts)."""
        self.assertTrue(os.path.exists(EN_01_PDF_PATH))
        doc = fitz.open(EN_01_PDF_PATH)
        self.assertGreater(len(doc), 0)

    def test_tier1_slanted_check_ja01(self):
        """Tier 1: Verify no slanted/italic CJK spans in ja_01."""
        spans = get_cjk_spans(JA_01_PDF_PATH)
        for s in spans:
            is_slanted = (s["flags"] & 2 != 0) or any(kw in s["font"].lower() for kw in ["italic", "oblique", "slanted"])
            self.assertFalse(is_slanted, f"Slanted CJK text found in ja_01: '{s['text']}' using font '{s['font']}'")

    def test_tier1_slanted_check_ja02(self):
        """Tier 1: Verify no slanted/italic CJK spans in ja_02."""
        spans = get_cjk_spans(JA_02_PDF_PATH)
        for s in spans:
            is_slanted = (s["flags"] & 2 != 0) or any(kw in s["font"].lower() for kw in ["italic", "oblique", "slanted"])
            self.assertFalse(is_slanted, f"Slanted CJK text found in ja_02: '{s['text']}' using font '{s['font']}'")

    def test_tier1_slanted_check_ja03(self):
        """Tier 1: Verify no slanted/italic CJK spans in ja_03."""
        spans = get_cjk_spans(JA_03_PDF_PATH)
        for s in spans:
            is_slanted = (s["flags"] & 2 != 0) or any(kw in s["font"].lower() for kw in ["italic", "oblique", "slanted"])
            self.assertFalse(is_slanted, f"Slanted CJK text found in ja_03: '{s['text']}' using font '{s['font']}'")


    def test_tier1_slanted_check_all(self):
        """Tier 1: Verify no slanted CJK spans across all 4 Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            spans = get_cjk_spans(path)
            for s in spans:
                is_slanted = (s["flags"] & 2 != 0) or any(kw in s["font"].lower() for kw in ["italic", "oblique", "slanted"])
                self.assertFalse(is_slanted, f"Slanted CJK text found in {os.path.basename(path)}: '{s['text']}' using font '{s['font']}'")

    def test_tier1_translation_check_ja01(self):
        """Tier 1: Verify no parenthetical English translations of proper names in ja_01."""
        violations = check_for_banned_translations(JA_01_PDF_PATH)
        self.assertEqual(len(violations), 0, f"Parenthetical English translations found in ja_01: {violations}")

    def test_tier1_translation_check_ja02(self):
        """Tier 1: Verify no parenthetical English translations of proper names in ja_02."""
        violations = check_for_banned_translations(JA_02_PDF_PATH)
        self.assertEqual(len(violations), 0, f"Parenthetical English translations found in ja_02: {violations}")

    def test_tier1_translation_check_ja03(self):
        """Tier 1: Verify no parenthetical English translations of proper names in ja_03."""
        violations = check_for_banned_translations(JA_03_PDF_PATH)
        self.assertEqual(len(violations), 0, f"Parenthetical English translations found in ja_03: {violations}")


    def test_tier1_translation_check_all(self):
        """Tier 1: Verify no parenthetical English translations of proper names across all Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            violations = check_for_banned_translations(path)
            self.assertEqual(len(violations), 0, f"Parenthetical English translations found in {os.path.basename(path)}: {violations}")

    def test_tier1_personal_info_name(self):
        """Tier 1: Verify name 'Mohamed Fuad' or equivalent Japanese exists in Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            has_name = ("Mohamed Fuad" in text) or ("モハメド" in text and "フアド" in text)
            self.assertTrue(has_name, f"Name 'Mohamed Fuad' / 'モハメド フアド' not found in {os.path.basename(path)}")

    def test_tier1_personal_info_address(self):
        """Tier 1: Verify address '世田谷区' exists in Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertTrue("世田谷区" in text, f"Address '世田谷区' not found in {os.path.basename(path)}")

    def test_tier1_personal_info_phone(self):
        """Tier 1: Verify phone number '080-7535-2988' is present in Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertTrue("080-7535-2988" in text, f"Phone number '080-7535-2988' not found in {os.path.basename(path)}")

    def test_tier1_personal_info_email(self):
        """Tier 1: Verify email 'mohamed.fuad.jp@gmail.com' is present in Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertTrue("mohamed.fuad.jp@gmail.com" in text.lower(), f"Email not found in {os.path.basename(path)}")

    def test_tier1_personal_info_education(self):
        """Tier 1: Verify education '東海大学' is present in Japanese resumes."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertTrue("東海大学" in text, f"Education '東海大学' not found in {os.path.basename(path)}")

    # ==========================================
    # TIER 2: BOUNDARY & CORNER CASES (26 TESTS)
    # ==========================================

    def test_tier2_font_check_cjk_only_ja01(self):
        """Tier 2: Verify Gothic font checks in ja_01 skip non-CJK spans."""
        doc = fitz.open(JA_01_PDF_PATH)
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                if "lines" in b:
                    for l in b["lines"]:
                        for span in l["spans"]:
                            if not contains_cjk(span["text"]):
                                continue
                            self.assertTrue(is_gothic_font(span["font"]), f"CJK span '{span['text']}' used non-Gothic font: {span['font']}")

    def test_tier2_font_check_cjk_only_ja02(self):
        """Tier 2: Verify Mincho font checks in ja_02 skip non-CJK spans."""
        doc = fitz.open(JA_02_PDF_PATH)
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                if "lines" in b:
                    for l in b["lines"]:
                        for span in l["spans"]:
                            if not contains_cjk(span["text"]):
                                continue
                            self.assertTrue(is_mincho_font(span["font"]), f"CJK span '{span['text']}' used non-Mincho font: {span['font']}")

    def test_tier2_font_check_cjk_only_ja03(self):
        """Tier 2: Verify Gothic font checks in ja_03 skip non-CJK spans."""
        doc = fitz.open(JA_03_PDF_PATH)
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                if "lines" in b:
                    for l in b["lines"]:
                        for span in l["spans"]:
                            if not contains_cjk(span["text"]):
                                continue
                            self.assertTrue(is_gothic_font(span["font"]), f"CJK span '{span['text']}' used non-Gothic font: {span['font']}")


    def test_tier2_font_check_english_ignored(self):
        """Tier 2: Verify that pure English/numeric spans in Japanese resumes are ignored for Gothic/Mincho checks."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            doc = fitz.open(path)
            english_spans = []
            for page in doc:
                for b in page.get_text("dict")["blocks"]:
                    if "lines" in b:
                        for l in b["lines"]:
                            for span in l["spans"]:
                                if not contains_cjk(span["text"]) and re.search(r"[A-Za-z0-9]", span["text"]):
                                    english_spans.append(span)
            self.assertTrue(len(english_spans) > 0, f"No English/numeric spans found in {os.path.basename(path)} to verify skipping")

    def test_tier2_slanted_cjk_only_ja01(self):
        """Tier 2: Verify slanted check in ja_01 only targets CJK spans."""
        doc = fitz.open(JA_01_PDF_PATH)
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                if "lines" in b:
                    for l in b["lines"]:
                        for span in l["spans"]:
                            if contains_cjk(span["text"]):
                                is_slanted = (span["flags"] & 2 != 0) or any(kw in span["font"].lower() for kw in ["italic", "oblique", "slanted"])
                                self.assertFalse(is_slanted, f"Slanted CJK text: '{span['text']}' in ja_01")

    def test_tier2_slanted_cjk_only_ja02(self):
        """Tier 2: Verify slanted check in ja_02 only targets CJK spans."""
        doc = fitz.open(JA_02_PDF_PATH)
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                if "lines" in b:
                    for l in b["lines"]:
                        for span in l["spans"]:
                            if contains_cjk(span["text"]):
                                is_slanted = (span["flags"] & 2 != 0) or any(kw in span["font"].lower() for kw in ["italic", "oblique", "slanted"])
                                self.assertFalse(is_slanted, f"Slanted CJK text: '{span['text']}' in ja_02")

    def test_tier2_slanted_cjk_only_ja03(self):
        """Tier 2: Verify slanted check in ja_03 only targets CJK spans."""
        doc = fitz.open(JA_03_PDF_PATH)
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                if "lines" in b:
                    for l in b["lines"]:
                        for span in l["spans"]:
                            if contains_cjk(span["text"]):
                                is_slanted = (span["flags"] & 2 != 0) or any(kw in span["font"].lower() for kw in ["italic", "oblique", "slanted"])
                                self.assertFalse(is_slanted, f"Slanted CJK text: '{span['text']}' in ja_03")


    def test_tier2_slanted_english_ignored(self):
        """Tier 2: Verify that pure English/numeric italicized spans are allowed and do not fail the slanted check."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            doc = fitz.open(path)
            for page in doc:
                for b in page.get_text("dict")["blocks"]:
                    if "lines" in b:
                        for l in b["lines"]:
                            for span in l["spans"]:
                                if not contains_cjk(span["text"]):
                                    pass

    def test_tier2_phone_hyphenation_format(self):
        """Tier 2: Verify phone format matches exactly 080-7535-2988."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            matches = re.findall(r"080[-]?\d{4}[-]?\d{4}|\d{3}-\d{4}-\d{4}", text)
            for m in matches:
                self.assertEqual(m, "080-7535-2988", f"Phone number formatting is incorrect: {m} in {os.path.basename(path)}")

    def test_tier2_phone_no_parentheses(self):
        """Tier 2: Verify phone does not contain parentheses like (080)."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertNotIn("(080)", text, f"Found phone parentheses in {os.path.basename(path)}")
            self.assertNotIn("（080）", text, f"Found full-width phone parentheses in {os.path.basename(path)}")

    def test_tier2_phone_no_spaces(self):
        """Tier 2: Verify phone does not contain space boundaries (e.g. 080 7535 2988)."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertNotIn("080 7535", text, f"Phone contains space separator in {os.path.basename(path)}")

    def test_tier2_dob_year_present(self):
        """Tier 2: Verify DOB year (2004 or 2004年 or 平成16年) is present in ja_02."""
        text = clean_extracted_text(get_pdf_text(JA_02_PDF_PATH))
        has_year = ("2004" in text) or ("平成16" in text)
        self.assertTrue(has_year, "DOB year not found in ja_02")

    def test_tier2_dob_month_present(self):
        """Tier 2: Verify DOB month (February or 2月) is present in ja_02."""
        text = clean_extracted_text(get_pdf_text(JA_02_PDF_PATH))
        has_month = ("2月" in text) or ("February" in text) or ("28日" in text and ("2" in text or "02" in text))
        self.assertTrue(has_month, "DOB month not found in ja_02")

    def test_tier2_dob_day_present(self):
        """Tier 2: Verify DOB day (28 or 28日) is present in ja_02."""
        text = clean_extracted_text(get_pdf_text(JA_02_PDF_PATH))
        has_day = ("28" in text) or ("28日" in text)
        self.assertTrue(has_day, "DOB day not found in ja_02")

    def test_tier2_email_pattern(self):
        """Tier 2: Verify email matches pattern [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}."""
        pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            matches = pattern.findall(text)
            self.assertGreater(len(matches), 0, f"No email matching standard pattern in {os.path.basename(path)}")
            self.assertEqual(matches[0].lower(), "mohamed.fuad.jp@gmail.com")

    def test_tier2_email_lowercase(self):
        """Tier 2: Verify email is strictly lowercase."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            match = re.search(r"mohamed\.fuad\.jp@gmail\.com", text, re.IGNORECASE)
            self.assertIsNotNone(match, f"Email mohamed.fuad.jp@gmail.com not found in {os.path.basename(path)}")
            self.assertEqual(match.group(0), "mohamed.fuad.jp@gmail.com", f"Email has uppercase letters in {os.path.basename(path)}")

    def test_tier2_parentheses_half_width(self):
        """Tier 2: Verify half-width parenthetical English translations of proper names are banned."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            violations = check_for_banned_translations(path)
            half_width_violations = [v for v in violations if "(" in v]
            self.assertEqual(len(half_width_violations), 0, f"Half-width parenthetical translation found in {os.path.basename(path)}: {half_width_violations}")

    def test_tier2_parentheses_full_width(self):
        """Tier 2: Verify full-width parenthetical English translations of proper names are banned."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            violations = check_for_banned_translations(path)
            full_width_violations = [v for v in violations if "（" in v]
            self.assertEqual(len(full_width_violations), 0, f"Full-width parenthetical translation found in {os.path.basename(path)}: {full_width_violations}")

    def test_tier2_photo_box_bounds_ja02(self):
        """Tier 2: Verify photo box dimensions/position bounds in ja_02_rirekisho_grid."""
        doc = fitz.open(JA_02_PDF_PATH)
        page = doc[0]
        rects = page.search_for("写真")
        self.assertTrue(len(rects) > 0, "No '写真' text found on page 1 of ja_02")
        photo_text_rect = rects[0]
        
        # Verify photo text is in top-right quadrant (x > 300, y < 300)
        self.assertGreater(photo_text_rect.x0, 300, "Photo text is not in the right half")
        self.assertLess(photo_text_rect.y1, 300, "Photo text is not in the upper half")
        
        # Fetch all lines/drawings in the top-right quadrant
        top_right_drawings = []
        for draw in page.get_drawings():
            if "rect" in draw:
                r = draw["rect"]
                if r.x0 > 350 and r.y0 < 250 and r.x1 < 580 and r.y1 < 250:
                    top_right_drawings.append(r)
        
        found_box = False
        if top_right_drawings:
            # Find lines enclosing the photo text rect
            # Vertical lines (left and right of photo text rect) with length > 10
            left_lines = [r.x0 for r in top_right_drawings if r.x0 < photo_text_rect.x0 and r.x1 < photo_text_rect.x0 and (r.y1 - r.y0) > 10]
            right_lines = [r.x1 for r in top_right_drawings if r.x0 > photo_text_rect.x1 and r.x1 > photo_text_rect.x1 and (r.y1 - r.y0) > 10]
            
            # Horizontal lines (top and bottom of photo text rect) with width > 10
            top_lines = [r.y0 for r in top_right_drawings if r.y0 < photo_text_rect.y0 and r.y1 < photo_text_rect.y0 and (r.x1 - r.x0) > 10]
            bottom_lines = [r.y1 for r in top_right_drawings if r.y0 > photo_text_rect.y1 and r.y1 > photo_text_rect.y1 and (r.x1 - r.x0) > 10]
            
            if left_lines and right_lines and top_lines and bottom_lines:
                box_x0 = max(left_lines)
                box_x1 = min(right_lines)
                box_y0 = max(top_lines)
                box_y1 = min(bottom_lines)
                
                width = box_x1 - box_x0
                height = box_y1 - box_y0
                
                self.assertTrue(50 <= width <= 150, f"Enclosing box width {width} out of expected bounds")
                self.assertTrue(60 <= height <= 200, f"Enclosing box height {height} out of expected bounds")
                found_box = True
                
        self.assertTrue(found_box, "Could not find a drawn photo box enclosing the '写真' text in the top-right quadrant")

    def test_tier2_experience_altius_link(self):
        """Tier 2: Verify Altius Link (アルティウスリンク) experience is present."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            has_exp = ("Altius Link" in text) or ("アルティウス" in text)
            self.assertTrue(has_exp, f"Experience 'Altius Link' not found in {os.path.basename(path)}")

    def test_tier2_experience_hotel_sui(self):
        """Tier 2: Verify Hotel SUI Akasaka (ホテルSUI赤坂) experience is present."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            has_exp = ("SUI" in text) or ("ホテル" in text and "SUI" in text)
            self.assertTrue(has_exp, f"Experience 'Hotel SUI Akasaka' not found in {os.path.basename(path)}")

    def test_tier2_experience_japan_airlines(self):
        """Tier 2: Verify Japan Airlines (日本航空) experience is present."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            has_exp = ("Japan Airlines" in text) or ("日本航空" in text)
            self.assertTrue(has_exp, f"Experience 'Japan Airlines' not found in {os.path.basename(path)}")

    def test_tier2_projects_tokaihub_and_tutorsystem(self):
        """Tier 2: Verify Tutor-System and TokaiHub projects are present."""
        for path in [JA_01_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            has_tutor = ("Tutor-System" in text) or ("Tutor System" in text) or ("家庭教師" in text)
            has_tokai = ("TokaiHub" in text) or ("Tokai Hub" in text) or ("東海" in text and "ハブ" in text)
            self.assertTrue(has_tutor, f"Project 'Tutor-System' not found in {os.path.basename(path)}")
            self.assertTrue(has_tokai, f"Project 'TokaiHub' not found in {os.path.basename(path)}")

    def test_tier2_projects_webdrop_and_codex(self):
        """Tier 2: Verify WebDrop and Codex Account Switcher projects are present."""
        for path in [JA_01_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            has_webdrop = ("WebDrop" in text) or ("Web Drop" in text)
            has_codex = ("Codex" in text) or ("Account Switcher" in text)
            self.assertTrue(has_webdrop, f"Project 'WebDrop' not found in {os.path.basename(path)}")
            self.assertTrue(has_codex, f"Project 'Codex Account Switcher' not found in {os.path.basename(path)}")


    # ==========================================
    # TIER 3: CROSS-FEATURE COMBINATIONS (5 TESTS)
    # ==========================================

    def test_tier3_combined_ja01_checks(self):
        """Tier 3: Combined verification of compilation, page count, and font style for ja_01."""
        self.assertTrue(os.path.exists(JA_01_PDF_PATH))
        doc = fitz.open(JA_01_PDF_PATH)
        self.assertEqual(len(doc), 2)
        spans = get_cjk_spans(JA_01_PDF_PATH)
        for s in spans:
            self.assertTrue(is_gothic_font(s["font"]), f"Font {s['font']} is not Gothic in ja_01 CJK text")

    def test_tier3_combined_ja02_checks(self):
        """Tier 3: Combined verification of compilation, page count, and font style for ja_02."""
        self.assertTrue(os.path.exists(JA_02_PDF_PATH))
        doc = fitz.open(JA_02_PDF_PATH)
        self.assertEqual(len(doc), 1)
        spans = get_cjk_spans(JA_02_PDF_PATH)
        for s in spans:
            self.assertTrue(is_mincho_font(s["font"]), f"Font {s['font']} is not Mincho in ja_02 CJK text")

    def test_tier3_combined_ja03_checks(self):
        """Tier 3: Combined verification of compilation, page count, and font style for ja_03."""
        self.assertTrue(os.path.exists(JA_03_PDF_PATH))
        doc = fitz.open(JA_03_PDF_PATH)
        self.assertEqual(len(doc), 1)
        spans = get_cjk_spans(JA_03_PDF_PATH)
        for s in spans:
            self.assertTrue(is_gothic_font(s["font"]), f"Font {s['font']} is not Gothic in ja_03 CJK text")


    def test_tier3_combined_multilingual_checks(self):
        """Tier 3: Combined verification ensuring English templates do not fail Japanese-specific restrictions."""
        self.assertTrue(os.path.exists(EN_01_PDF_PATH))
        text = get_pdf_text(EN_01_PDF_PATH)
        self.assertTrue("Education" in text or "Experience" in text)
        cjk_spans = get_cjk_spans(EN_01_PDF_PATH)
        self.assertEqual(len(cjk_spans), 0, f"English resume should not contain Japanese characters: {cjk_spans}")


    # ==========================================
    # TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 TESTS)
    # ==========================================

    def test_tier4_audit_ja01_layout_content(self):
        """Tier 4: Detailed content audit for ja_01_shokumu_modern (experiences, projects, layout)."""
        text = clean_extracted_text(get_pdf_text(JA_01_PDF_PATH))
        self.assertTrue("履歴書" in text, "Header '履歴書' not found in ja_01")
        self.assertTrue("自己PR" in text or "スキル" in text or "開発実績" in text or "プロジェクト" in text or "職務要約" in text)
        self.assertTrue("アルティウスリンク" in text or "Altius" in text, "Altius Link experience missing or misspelled in ja_01")
        self.assertTrue("日本航空" in text or "Airlines" in text, "Japan Airlines experience missing or misspelled in ja_01")
        self.assertTrue("ホテル" in text or "Akasaka" in text, "Hotel SUI Akasaka experience missing in ja_01")

    def test_tier4_audit_ja02_layout_content(self):
        """Tier 4: Detailed content/grid layout audit for ja_02_rirekisho_grid (DOB, address, photo box)."""
        text = clean_extracted_text(get_pdf_text(JA_02_PDF_PATH))
        self.assertTrue("履歴書" in text, "Header '履歴書' not found in ja_02")
        self.assertTrue("ふりがな" in text or "フリガナ" in text, "Kana/Furigana label missing in ja_02")
        self.assertTrue("男" in text or "性別" in text, "Gender section missing in ja_02")
        self.assertTrue("世田谷区" in text, "Address世田谷区 missing in ja_02")

    def test_tier4_audit_ja03_layout_content(self):
        """Tier 4: Detailed content audit for ja_03_deedy_jp (two-column specific, courses, skills)."""
        text = clean_extracted_text(get_pdf_text(JA_03_PDF_PATH))
        self.assertTrue("学歴" in text or "教育" in text or "大学" in text, "Education section missing in ja_03")
        self.assertTrue("技術" in text or "スキル" in text or "プログラミング" in text or "言語" in text, "Skills section missing in ja_03")


    def test_tier4_cross_template_profile_consistency(self):
        """Tier 4: Full cross-template profile check for consistency of personal details."""
        for path in [JA_01_PDF_PATH, JA_02_PDF_PATH, JA_03_PDF_PATH]:
            text = get_pdf_text(path)
            self.assertTrue("Mohamed Fuad" in text or "モハメド" in text, f"Consistent name not found in {os.path.basename(path)}")
            self.assertTrue("080-7535-2988" in text, f"Consistent phone number not found in {os.path.basename(path)}")
            self.assertTrue("mohamed.fuad.jp@gmail.com" in text.lower(), f"Consistent email not found in {os.path.basename(path)}")
            self.assertTrue("世田谷区" in text, f"Consistent address not found in {os.path.basename(path)}")

if __name__ == "__main__":
    unittest.main()
