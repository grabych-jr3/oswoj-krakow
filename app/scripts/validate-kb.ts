import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Procedure, Office } from '../src/contracts/kb';

const PROCEDURES_PATH = resolve(process.cwd(), 'data/kb/procedures.json');
const OFFICES_PATH = resolve(process.cwd(), 'data/kb/offices_raw.json');

function validate() {
  console.log('🔍 [B2] Валидация базы знаний...');

  if (!existsSync(PROCEDURES_PATH)) {
    throw new Error(`Файл не найден: ${PROCEDURES_PATH}`);
  }

  const rawProcedures = JSON.parse(readFileSync(PROCEDURES_PATH, 'utf-8'));
  if (!Array.isArray(rawProcedures)) {
    throw new Error('procedures.json должен быть массивом');
  }

  console.log(`Проверяем ${rawProcedures.length} процедур по Zod-схеме Procedure...`);
  let validCount = 0;
  for (const item of rawProcedures) {
    const res = Procedure.safeParse(item);
    if (!res.success) {
      console.error(`❌ Ошибка в процедуре ${item?.symbol}:`, JSON.stringify(res.error.issues, null, 2));
      process.exit(1);
    }
    validCount++;
  }
  console.log(`✅ Все ${validCount} процедур соответствуют схеме Procedure!`);

  if (existsSync(OFFICES_PATH)) {
    const rawOffices = JSON.parse(readFileSync(OFFICES_PATH, 'utf-8'));
    console.log(`Проверяем ${rawOffices.length} отделений по Zod-схеме Office...`);
    let validOffices = 0;
    for (const off of rawOffices) {
      const res = Office.safeParse(off);
      if (!res.success) {
        console.error(`❌ Ошибка в отделении ${off?.id}:`, JSON.stringify(res.error.issues, null, 2));
        process.exit(1);
      }
      validOffices++;
    }
    console.log(`✅ Все ${validOffices} отделений соответствуют схеме Office!`);
  }
}

validate();