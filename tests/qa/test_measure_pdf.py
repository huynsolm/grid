import importlib.util
from pathlib import Path
import tempfile
import unittest

from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

MODULE_PATH = Path(__file__).resolve().parents[2] / 'scripts/qa/measure_pdf.py'
spec = importlib.util.spec_from_file_location('measure_pdf', MODULE_PATH)
measurement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(measurement)


class MeasurePDFTests(unittest.TestCase):
    def make_pdf(self, directory, width=210, height=297, length=100, pages=1, line=True, rotated=False, userunit=1):
        target = Path(directory) / 'fixture.pdf'
        c = canvas.Canvas(str(target), pagesize=(width * mm / userunit, height * mm / userunit))
        if rotated:
            c.setPageRotation(90)
        for _ in range(pages):
            if line:
                c.setStrokeColorRGB(208/255, 0, 0)
                c.setLineWidth(0.25 * mm / userunit)
                c.line(10*mm/userunit, 20*mm/userunit, (10+length)*mm/userunit, 20*mm/userunit)
            c.showPage()
        c.save()
        return target

    def test_exact_a4_and_calibration_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp), 'portrait')
            self.assertEqual(result['status'], 'pass')
            self.assertAlmostEqual(result['pages'][0]['calibration']['length_mm'], 100, places=3)

    def test_wrong_page_dimensions_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, width=211), 'portrait')
            self.assertEqual(result['status'], 'fail')

    def test_page_width_error_0111_mm_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, width=209.889), 'portrait')
            self.assertEqual(result['status'], 'pass')
            self.assertEqual(result['page_size_tolerance_mm'], 0.2)
            self.assertEqual(result['calibration_tolerance_mm'], 0.1)

    def test_page_width_error_025_mm_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, width=210.25), 'portrait')
            self.assertEqual(result['status'], 'fail')

    def test_calibration_error_011_mm_still_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, length=100.11), 'portrait')
            self.assertTrue(result['pages'][0]['dimensions_pass'])
            self.assertFalse(result['pages'][0]['calibration']['pass'])
            self.assertEqual(result['status'], 'fail')

    def test_wrong_calibration_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, length=99), 'portrait')
            self.assertEqual(result['status'], 'fail')

    def test_second_blank_page_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, pages=2), 'portrait')
            self.assertEqual(result['status'], 'fail')

    def test_missing_calibration_is_unverified(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, line=False), 'portrait')
            self.assertEqual(result['status'], 'unverified')

    def test_landscape_and_rotation(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = measurement.measure_pdf(self.make_pdf(tmp, width=297, height=210), 'landscape')
            self.assertEqual(result['status'], 'pass')
            rotated = measurement.measure_pdf(self.make_pdf(tmp, rotated=True), 'portrait')
            # ReportLab swaps MediaBox axes for setPageRotation; displayed size stays portrait.
            self.assertEqual(rotated['status'], 'pass')
            self.assertEqual(rotated['pages'][0]['rotation'], 90)

    def test_userunit_and_wrong_expected_orientation(self):
        # Minimal independent PDF with explicit UserUnit and a rotated MediaBox.
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'unit.pdf'
            width, height = 210*mm/2, 297*mm/2
            stream = f'0.8156862745 0 0 RG 1 w 10 20 m {10+100*mm/2} 20 l S'.encode()
            objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
                       b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
                       f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Rotate 90 /UserUnit 2 /Resources << >> /Contents 4 0 R >>'.encode(),
                       b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream']
            data = b'%PDF-1.7\n'
            offsets = []
            for index, obj in enumerate(objects, 1):
                offsets.append(len(data))
                data += f'{index} 0 obj\n'.encode() + obj + b'\nendobj\n'
            xref = len(data)
            data += b'xref\n0 5\n0000000000 65535 f \n'
            data += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets)
            data += f'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
            target.write_bytes(data)
            result = measurement.measure_pdf(target, 'landscape')
            self.assertEqual(result['status'], 'pass')
            self.assertEqual(result['pages'][0]['user_unit'], 2)
            self.assertEqual(measurement.measure_pdf(target, 'portrait')['status'], 'fail')

if __name__ == '__main__':
    unittest.main()
