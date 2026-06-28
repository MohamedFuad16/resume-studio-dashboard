import os
import re
import shutil
import tempfile
import subprocess
import unittest
import fitz

TECTONIC_PATH = "/opt/homebrew/bin/tectonic"
JA_DIR = "/Users/mfuad16/Documents/Resume/ja"
OUTPUT_DIR = "/Users/mfuad16/Documents/Resume/output"

class TestAdversarialResumes(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def compile_tex(self, tex_content, base_name):
        """Compile raw tex content and return the path to the PDF."""
        tex_path = os.path.join(self.temp_dir, f"{base_name}.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex_content)
        
        # Run tectonic
        res = subprocess.run(
            [TECTONIC_PATH, tex_path, "--outdir", self.temp_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        pdf_path = os.path.join(self.temp_dir, f"{base_name}.pdf")
        if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
            print(f"Compilation failed for {base_name}:")
            print(res.stdout)
            print(res.stderr)
            return None
        return pdf_path

    # --- ADV-01: Page limit stress testing ---
    

    def test_ja02_page_limit_stress(self):
        """Verify if ja_02_rirekisho_grid is layout-stable when adding a minor detail to education or work."""
        original_path = os.path.join(JA_DIR, "02_rirekisho_grid.tex")
        with open(original_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Let's modify a description. In ja_02, the education description is:
        # "主要科目: データ構造とアルゴリズム、コンピュータネットワーク、データベースシステム、オペレーティングシステム、ソフトウェア工学、離散数学、Webプログラミング"
        # Let's add more text to make it wrap to one more line:
        old_text = "主要科目: データ構造とアルゴリズム、コンピュータネットワーク、データベースシステム、"
        new_text = "主要科目: データ構造とアルゴリズム、コンピュータネットワーク、データベースシステム、コンパイラ構成、人工知能、"
        
        modified_content = content.replace(old_text, new_text)
        pdf_path = self.compile_tex(modified_content, "ja_02_stressed")
        self.assertIsNotNone(pdf_path, "Stressed ja_02 failed to compile")
        
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        print(f"ja_02 with extra courses: {page_count} pages (expected: 1)")
        self.assertEqual(page_count, 1, "ja_02_rirekisho_grid overflows to page 2 under minor description increase!")

    def test_ja03_page_limit_stress(self):
        """Verify if ja_03_deedy_jp is layout-stable when adding an extra interest or skill."""
        original_path = os.path.join(JA_DIR, "03_deedy_jp.tex")
        with open(original_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Let's append an item to the interest list:
        old_item = "\\item macOS \\& iOSアプリ開発"
        new_item = old_item + "\n      \\item クラウドネイティブシステムアーキテクチャ\n      \\item マイクロサービス設計開発"
        
        modified_content = content.replace(old_item, new_item)
        pdf_path = self.compile_tex(modified_content, "ja_03_stressed")
        self.assertIsNotNone(pdf_path, "Stressed ja_03 failed to compile")
        
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        print(f"ja_03 with 2 extra interest bullets: {page_count} pages (expected: 1)")
        self.assertEqual(page_count, 1, "ja_03_deedy_jp overflows to page 2 under content stress!")

    def test_ja01_page_limit_stress(self):
        """Verify if ja_01_shokumu_modern is layout-stable when adding an extra project item on page 2."""
        original_path = os.path.join(JA_DIR, "01_shokumu_modern.tex")
        with open(original_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Let's append a bullet to the Codex project on page 2:
        old_bullet = "\\item GitHub\\ \\href{https://github.com/MohamedFuad16/Codex-Acc-Switcher}{\\color{jpblue}github.com/MohamedFuad16/Codex-Acc-Switcher}"
        new_bullet = old_bullet + "\n  \\item このプロジェクトはmacOSネイティブのメニューバーユーティリティとして完全に動作します。\n  \\item 複数アカウントの切り替え処理は、Keychainサービスと安全に連携して実装されています。"
        
        modified_content = content.replace(old_bullet, new_bullet)
        pdf_path = self.compile_tex(modified_content, "ja_01_stressed")
        self.assertIsNotNone(pdf_path, "Stressed ja_01 failed to compile")
        
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        print(f"ja_01 with 2 extra project bullets: {page_count} pages (expected: 2)")
        self.assertEqual(page_count, 2, "ja_01_shokumu_modern overflows to page 3 under content stress!")

    # --- ADV-02: Strict validation of formatting constraints (italics/slanted CJK) ---
    
    def test_static_cjk_italics(self):
        """Static analysis of LaTeX source files to ensure no italic/slanted commands are applied to CJK texts."""
        italic_commands = [r"\textit", r"\itshape", r"\emph", r"\textsl", r"\slshape"]
        cjk_range = r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]"
        
        violations = []
        for file_name in os.listdir(JA_DIR):
            if not file_name.endswith(".tex"):
                continue
            path = os.path.join(JA_DIR, file_name)
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            for idx, line in enumerate(lines):
                # Ignore comments
                if line.strip().startswith("%"):
                    continue
                # Look for CJK characters on the line
                if not re.search(cjk_range, line):
                    continue
                # If CJK exists, look for any italic command
                for cmd in italic_commands:
                    if cmd in line:
                        violations.append(f"{file_name}:{idx+1}: Potential CJK italic: '{line.strip()}' using '{cmd}'")
                        
        self.assertEqual(len(violations), 0, f"Italic CJK commands detected in LaTeX source: {violations}")

    # --- ADV-03: Enhanced Banned Translations check ---
    
    def test_banned_translations_enhanced(self):
        """Verify no English translations exist in parentheses next to any Japanese names or major entities."""
        allowed_eng_keywords = {
            "n", "n2", "pwa", "react", "typescript", "kddi", "aws", "amplify", "cognito", "ses",
            "otp", "webrtc", "opfs", "appkit", "swiftui", "swift", "macos", "ios", "llm", "p2p", "c",
            "java", "sql", "html", "css", "git", "github", "vite", "node", "js", "express",
            "tailwinds", "tailwind", "flask", "numpy", "pandas", "sqlite", "mysql", "postgresql",
            "vs", "code", "vim", "bash", "shell", "ieee", "jlpt", "pdf", "ai", "cm"
        }
        
        pattern = re.compile(r"([\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]{2,})\s*[\(\uff08\[]([^\)\uff09\]]+)[\)\uff09\]]")
        
        for path in [
            os.path.join(OUTPUT_DIR, "ja_01_shokumu_modern.pdf"),
            os.path.join(OUTPUT_DIR, "ja_02_rirekisho_grid.pdf"),
            os.path.join(OUTPUT_DIR, "ja_03_deedy_jp.pdf"),
        ]:
            if not os.path.exists(path):
                continue
            doc = fitz.open(path)
            for page_idx, page in enumerate(doc):
                text = page.get_text()
                matches = pattern.finditer(text)
                for match in matches:
                    cjk_part = match.group(1)
                    paren_part = match.group(2)
                    
                    # Split paren contents into words and check if it contains any non-allowed English words
                    words = re.findall(r"[A-Za-z]+", paren_part.lower())
                    if not words:
                        continue # contains only Japanese or numbers (e.g.満22歳, 3年次, etc.) - allowed
                    
                    # If there's an English word that is not in the allowed list, it's highly likely to be a translation!
                    invalid_words = [w for w in words if w not in allowed_eng_keywords]
                    if invalid_words:
                        self.fail(f"Banned parenthetical English translation detected in {os.path.basename(path)}: "
                                  f"'{cjk_part} ({paren_part})' (invalid words: {invalid_words})")

    # --- ADV-04: Robust PDF extraction checks (no double spaces, clean CJK text) ---
    
    def test_cjk_double_spaces_and_tabs(self):
        """Ensure no double spaces or horizontal tabs are present between CJK characters in the extracted PDF text."""
        cjk_range = r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]"
        pattern = re.compile(cjk_range + r"[ \t]+" + cjk_range)
        
        for path in [
            os.path.join(OUTPUT_DIR, "ja_01_shokumu_modern.pdf"),
            os.path.join(OUTPUT_DIR, "ja_02_rirekisho_grid.pdf"),
            os.path.join(OUTPUT_DIR, "ja_03_deedy_jp.pdf"),
        ]:
            if not os.path.exists(path):
                continue
            doc = fitz.open(path)
            for page in doc:
                text = page.get_text()
                matches = pattern.findall(text)
                self.assertEqual(len(matches), 0, f"Found unexpected spacing inside CJK characters in {os.path.basename(path)}: {matches}")

    # --- ADV-05: Strict Phone Number Format Check ---
    
    def test_phone_number_strict_matching(self):
        """Verify that the phone number matches exactly the requested format (half-width, specific hyphenation, no spaces)."""
        expected_phone = "080-7535-2988"
        for path in [
            os.path.join(OUTPUT_DIR, "ja_01_shokumu_modern.pdf"),
            os.path.join(OUTPUT_DIR, "ja_02_rirekisho_grid.pdf"),
            os.path.join(OUTPUT_DIR, "ja_03_deedy_jp.pdf"),
        ]:
            if not os.path.exists(path):
                continue
            text = fitz.open(path)[0].get_text()
            
            matches = re.findall(r"\+?\d[\d\s-]*\d", text)
            phone_matches = []
            for m in matches:
                cleaned = re.sub(r"\s+", "", m)
                if len(cleaned.replace("-", "").replace("+", "")) >= 10:
                    phone_matches.append(m.strip())
                    
            self.assertGreater(len(phone_matches), 0, f"No phone number found in {os.path.basename(path)}")
            for m in phone_matches:
                self.assertEqual(m, expected_phone, f"Phone number '{m}' does not match expected format '{expected_phone}' in {os.path.basename(path)}")

if __name__ == "__main__":
    unittest.main()
