# Review ciclo 17

Veredicto: APROBADO

Hallazgos: 0 bloqueantes, 0 importantes, 1 menor.

## Comprobaciones
- `branchWeekly`/`shortDate`/`unitFor`/`BranchWeek` idénticos a la spec §7. Reutiliza `weekly()` (semanas lun–dom, `[start, end)`), cuenta archivadas. BW1–BW3 presentes; no se tocó ningún assert existente.
- `aria-label` de Deshacer (HomeView y TrackerCard) con `unitFor`; textos visibles intactos. Solo U4 y U23 cambian, como pide la spec; U-HV1 añadido tal cual.
- Bloque «Últimas semanas»: gráfico y leyenda `aria-hidden`, `ul.sr-only`, `bg-hero`/`bg-villain-bg`, borde discontinuo en la semana en curso, solo con XP, sin línea «Esta semana», tokens sin hex ni `slate-*`. Sin cambios en persistencia ni dependencias.
- `npm run build` OK. `npm run lint` (el script ya lleva `--deny-warnings`) código 0. `npm test` x3: 85/85 cada vez, sin intermitencias.

## Hallazgos
- menor: `app/src/components/HomeView.tsx` (leyenda, ~l.180): texto y muestras en un único flex-wrap; en 390 px puede partir «HERO ·» y la muestra en líneas distintas. Verificar visualmente el checklist manual (390 px, sin scroll horizontal), no verificable aquí.
