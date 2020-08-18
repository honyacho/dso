import { assert, Client } from "../deps.ts";
import { dso } from "../mod.ts";
import { FieldType, Defaults } from "./field.ts";
import { BaseModel } from "./model.ts";
import { columnIndexesList, Index } from "./index.ts";
import { charsetList } from "./charset.ts";

export async function sync(client: Client, model: BaseModel, force: boolean) {
  if (force) {
    await client.execute(`DROP TABLE IF EXISTS ${model.modelName}`);
  }

  let defs = model.modelFields
    .map((field) => {
      let def = field.name;
      let type = "";
      switch (field.type) {
        case FieldType.STRING:
          type = `VARCHAR(${field.length || 255})`;
          break;
        case FieldType.INT:
          type = `INT(${field.length || 11})`;
          break;
        case FieldType.DATE:
          type = `TIMESTAMP`;
          break;
        case FieldType.BOOLEAN:
          type = `TINYINT(1)`;
          break;
        case FieldType.TEXT:
          type = `TEXT(${field.length || 65535})`;
          break;
        case FieldType.LONGTEXT: {
          type = `LONGTEXT`;
          break;
        }
        case FieldType.GeoPOINT: {
          type = `POINT`;
          break;
        }
      }
      def += ` ${type}`;
      if (field.charset) {
        def += ` CHARACTER SET ${charsetList[field.charset]}`;
      }
      if (field.notNull) def += " NOT NULL";
      if (field.default != null) {
        if (field.default === Defaults.NULL) {
          def += ` NULL DEFAULT NULL`;
        } else {
          def += ` DEFAULT ${field.default}`;
        }
      }
      if (field.autoIncrement) def += " AUTO_INCREMENT";
      if (field.autoUpdate) {
        assert(
          field.type === FieldType.DATE,
          "AutoUpdate only support Date field",
        );
        def += ` ON UPDATE CURRENT_TIMESTAMP()`;
      }
      return def;
    })
    .join(", ");

  if (model.primaryKey) {
    defs += `, PRIMARY KEY (${model.primaryKey.name})`;
  }

  // get field indexes
  for (const arrayKey in model.columnIndexes) {
    const indexes = model.columnIndexes[arrayKey];
    for (const key of indexes) {
      defs += `, ${columnIndexesList[arrayKey]} (${key.name})`;
    }
  }

  // get model indexes
  model.indexes.forEach((index: Index) => {
    defs += `, ${columnIndexesList[index.type]} (${index.columns.join(", ")})`;
  });

  const sql = [
    "CREATE TABLE IF NOT EXISTS",
    model.modelName,
    "(",
    defs,
    ")",
    `ENGINE=InnoDB DEFAULT CHARSET=${charsetList[model.charset]};`,
  ].join(" ");
  console.log(sql);

  dso.showQueryLog && console.log(`\n[ DSO:SYNC ]\nSQL:\t ${sql}\n`);
  const result = await client.execute(sql);
  dso.showQueryLog && console.log(`REUSLT:\t`, result, `\n`);
}
