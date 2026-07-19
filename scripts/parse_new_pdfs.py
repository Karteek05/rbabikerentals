import json
import os
import re
import sys

import pdfplumber

FOLDER = os.path.join(os.path.dirname(__file__), "..", "new")
CHASSIS_RE = re.compile(r"\b(ME4JK[A-Z0-9]{10,20}|MD625[A-Z0-9]{10,20})\b", re.I)


def extract_text(path: str) -> str:
    with pdfplumber.open(path) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages[:10])


def extract_chassis(text: str) -> str | None:
    for pattern in (
        r"Frame No\.?:\s*(ME4JK[A-Z0-9]+)",
        r"Chassis No\.?\s*(ME4JK[A-Z0-9]+)",
        r"FRAME\s*NO\.?\s*(ME4JK[A-Z0-9]+)",
        r"Frame No\s+(MD625[A-Z0-9]+)",
        r"Chassis No\.?\s*(MD625[A-Z0-9]+)",
        r"JK42[A-Z0-9]+(ME4JK[A-Z0-9]+)",
    ):
        match = re.search(pattern, text, re.I)
        if match:
            value = match.group(1).upper()
            if value.startswith("ME4JK") or value.startswith("MD625"):
                return value

    loose = re.findall(r"(ME4JK[A-Z0-9]{10,20}|MD625[A-Z0-9]{10,20})", text.upper())
    unique = sorted(set(loose))
    if len(unique) == 1:
        return unique[0]

    found = CHASSIS_RE.findall(text.upper())
    unique_found = sorted(set(found))
    return unique_found[0].upper() if len(unique_found) == 1 else None


def guess_doc_type(name: str, text: str) -> str:
    lower = name.lower()
    upper = text.upper()
    if "policyschedule" in lower or " ins" in lower or "PACKAGE POLICY" in upper:
        return "insurance"
    if lower in ("766.pdf", "767.pdf") or "VEHICLE INVOICE" in upper or "TAX INVOICE" in upper:
        return "invoice"
    if "FORM 20" in upper or "REGISTRATION OF A MOTOR VEHICLE" in upper:
        return "rc"
    return "invoice"


def guess_catalog_vehicle_id(text: str) -> str | None:
    upper = text.upper()
    if " DIO" in upper or "/DIO" in upper:
        return "veh_002"
    if "ACTIVA" in upper:
        return "veh_001"
    if "JUPITER" in upper:
        return "veh_003"
    return None


def parse_file(name: str) -> dict:
    path = os.path.join(FOLDER, name)
    text = extract_text(path)
    return {
        "file": name,
        "path": path,
        "doc_type": guess_doc_type(name, text),
        "chassis_number": extract_chassis(text),
        "catalog_vehicle_id": guess_catalog_vehicle_id(text),
    }


def main() -> None:
    rows = []
    for name in sorted(os.listdir(FOLDER)):
        if not name.lower().endswith(".pdf"):
            continue
        rows.append(parse_file(name))
    if "--json" in sys.argv:
        print(json.dumps(rows, indent=2))
    else:
        for row in rows:
            print(
                f"{row['file']}\t{row['doc_type']}\tchassis={row['chassis_number'] or ''}"
            )


if __name__ == "__main__":
    main()
