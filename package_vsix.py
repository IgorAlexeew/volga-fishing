"""Build the offline VS Code extension package from its manifest and local assets."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
config = json.loads((ROOT / "package.json").read_text(encoding="utf-8-sig"))
name, version = config["name"], config["version"]
package = ET.Element("PackageManifest", Version="2.0.0",
                     xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011")
metadata = ET.SubElement(package, "Metadata")
ET.SubElement(metadata, "Identity", Language="ru-RU", Id=name, Version=version, Publisher=config["publisher"])
for tag, value in [("DisplayName", config["displayName"]), ("Description", config["description"]),
                   ("Categories", "Other"), ("Icon", "extension/" + config["icon"])]:
    ET.SubElement(metadata, tag).text = value
properties = ET.SubElement(metadata, "Properties")
ET.SubElement(properties, "Property", Id="Microsoft.VisualStudio.Code.Engine", Value=config["engines"]["vscode"])
installation = ET.SubElement(package, "Installation")
ET.SubElement(installation, "InstallationTarget", Id="Microsoft.VisualStudio.Code")
ET.SubElement(package, "Dependencies")
assets = ET.SubElement(package, "Assets")
for kind, filename in [("Code.Manifest", "package.json"), ("Services.Content.Details", "README.md"),
                       ("Services.Icons.Default", config["icon"])]:
    ET.SubElement(assets, "Asset", Type="Microsoft.VisualStudio." + kind, Path="extension/" + filename,
                  Addressable="true")
types = ET.Element("Types", xmlns="http://schemas.openxmlformats.org/package/2006/content-types")
for ext, mime in {"json": "application/json", "js": "application/javascript", "md": "text/markdown",
                  "html": "text/html", "css": "text/css", "jpg": "image/jpeg", "png": "image/png",
                  "webp": "image/webp", "svg": "image/svg+xml", "txt": "text/plain", "vsixmanifest": "text/xml"}.items():
    ET.SubElement(types, "Default", Extension=ext, ContentType=mime)
destination = ROOT / f"{name}-{version}.vsix"
with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
    archive.writestr("extension.vsixmanifest", ET.tostring(package, encoding="utf-8", xml_declaration=True))
    archive.writestr("[Content_Types].xml", ET.tostring(types, encoding="utf-8", xml_declaration=True))
    files = [ROOT / f for f in ("package.json", "README.md", "extension.js")]
    files.extend(p for p in sorted((ROOT / "media").rglob("*")) if p.is_file())
    for source in files:
        archive.write(source, "extension/" + source.relative_to(ROOT).as_posix())
print(destination.name)
