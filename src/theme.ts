import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** Warm lamp-light amber: the one accent on an otherwise neutral, charcoal interface. */
const amber: MantineColorsTuple = [
  '#fff7e6', '#ffecc4', '#ffdd97', '#ffce6b', '#ffc149',
  '#f5ae35', '#de9623', '#b57614', '#8c590b', '#633d04',
];

export const theme = createTheme({
  primaryColor: 'amber',
  primaryShade: 5,
  autoContrast: true,
  colors: { amber },
  defaultRadius: 'md',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontWeight: '600' },
});
