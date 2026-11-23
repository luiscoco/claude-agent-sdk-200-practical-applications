import json
import sys
from pathlib import Path

notebook = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
cell = next(cell for cell in notebook["cells"] if cell.get("id") == "pricing-cell")
source = cell["source"]
if isinstance(source, list):
    source = "".join(source)
namespace = {}
exec(compile(source, "checkout.ipynb#pricing-cell", "exec"), namespace)
result = {
    "pythonVersion": sys.version.split()[0],
    "cellId": cell["id"],
    "exampleTotalCents": namespace["example_total_cents"],
    "additionalTotalCents": namespace["calculate_total"]([1000, 2000], 250),
}
print(json.dumps(result))
