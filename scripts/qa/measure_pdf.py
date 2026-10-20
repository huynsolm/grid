"""Measure user-saved U1 PDFs. Does not create PDFs or assert manual QA passed."""
import argparse
import json
import math
from pathlib import Path
import sys

import pdfplumber
from pdfminer.pdftypes import resolve1

PT_TO_MM = 25.4 / 72
PAGE_SIZE_TOLERANCE_MM = 0.2
CALIBRATION_TOLERANCE_MM = 0.1
CALIBRATION_RGB = (208 / 255, 0, 0)


def _calibration(page, factor):
    candidates = []
    for obj in [*page.lines, *page.curves]:
        color = obj.get('stroking_color')
        if not isinstance(color, (list, tuple)) or len(color) != 3:
            continue
        if any(abs(a - b) > 0.005 for a, b in zip(color, CALIBRATION_RGB)):
            continue
        # Reject Bezier curves rather than mistaking their chord for a line.
        if any(command[0] not in ('m', 'l') for command in obj.get('path', [])):
            continue
        points = obj.get('pts', [])
        if len(points) != 2:
            continue
        a, b = points
        length = math.hypot(b[0] - a[0], b[1] - a[1]) * factor
        if length <= 0:
            continue
        candidates.append({'endpoints_pt': [list(a), list(b)], 'length_mm': length,
                           'error_mm': abs(length - 100), 'pass': abs(length - 100) <= CALIBRATION_TOLERANCE_MM})
    if len(candidates) != 1:
        return {'status': 'unverified', 'candidate_count': len(candidates),
                'reason': 'Expected exactly one #d00000 straight vector calibration line.'}
    return {'status': 'measured', **candidates[0]}


def measure_pdf(path, orientation):
    if orientation not in ('portrait', 'landscape'):
        raise ValueError('Expected portrait or landscape')
    expected = (210, 297) if orientation == 'portrait' else (297, 210)
    result = {'file': str(path), 'pdfplumber_version': pdfplumber.__version__,
              'expected_orientation': orientation,
              'page_size_tolerance_mm': PAGE_SIZE_TOLERANCE_MM,
              'calibration_tolerance_mm': CALIBRATION_TOLERANCE_MM,
              'manual_visual_check': 'pending', 'pages': []}
    with pdfplumber.open(path) as pdf:
        result['page_count'] = len(pdf.pages)
        for page in pdf.pages:
            attrs = page.page_obj.attrs
            media = [float(resolve1(value)) for value in resolve1(attrs['MediaBox'])]
            user_unit = float(resolve1(attrs.get('UserUnit', 1)))
            if not math.isfinite(user_unit) or user_unit <= 0:
                raise ValueError('Invalid PDF UserUnit')
            rotation = int(page.rotation) % 360
            if rotation not in (0, 90, 180, 270):
                raise ValueError('Unsupported PDF rotation')
            width, height = abs(media[2] - media[0]), abs(media[3] - media[1])
            if rotation in (90, 270):
                width, height = height, width
            factor = PT_TO_MM * user_unit
            dimensions = (width * factor, height * factor)
            errors = [abs(a - b) for a, b in zip(dimensions, expected)]
            calibration = _calibration(page, factor)
            result['pages'].append({'page': page.page_number, 'mediabox': media,
                                    'user_unit': user_unit, 'rotation': rotation,
                                    'dimensions_mm': list(dimensions), 'axis_errors_mm': errors,
                                    'dimensions_pass': all(error <= PAGE_SIZE_TOLERANCE_MM for error in errors),
                                    'calibration': calibration})
    failed = result['page_count'] != 1 or any(
        not page['dimensions_pass'] or page['calibration'].get('pass') is False
        for page in result['pages'])
    missing = any(page['calibration']['status'] == 'unverified' for page in result['pages'])
    result['status'] = 'fail' if failed else ('unverified' if missing else 'pass')
    result['scope'] = 'Geometry only; user print-dialog provenance and visual checks remain required.'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--orientation', required=True, choices=['portrait', 'landscape'])
    parser.add_argument('--output', type=Path, help='Optional JSON result path (does not overwrite the QA log).')
    args = parser.parse_args()
    try:
        result = measure_pdf(args.pdf, args.orientation)
    except Exception as error:
        result = {'file': str(args.pdf), 'status': 'unverified', 'reason': str(error),
                  'page_size_tolerance_mm': PAGE_SIZE_TOLERANCE_MM,
                  'calibration_tolerance_mm': CALIBRATION_TOLERANCE_MM}
    content = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content + '\n', encoding='utf-8')
    print(content)
    return 0 if result['status'] == 'pass' else (1 if result['status'] == 'fail' else 2)


if __name__ == '__main__':
    sys.exit(main())
