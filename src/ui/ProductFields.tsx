import { Anchor, Button, Group, NumberInput, Stack, TextInput } from '@mantine/core';
import { IconExternalLink, IconSearch } from '@tabler/icons-react';
import type { ProductLink } from '../model/types.ts';
import { leroySearchUrl } from '../shop/leroy.ts';

/**
 * Ties a placed item to a real product: search the shop in a new tab, then
 * paste back the product you chose so it lands on the shopping list.
 */
export function ProductFields({
  product,
  search,
  onChange,
}: {
  product: ProductLink | undefined;
  search: string;
  onChange: (product: ProductLink) => void;
}) {
  const set = (patch: ProductLink) => onChange({ ...product, ...patch });
  const url = product?.url?.trim();
  const valid = !!url && /^https?:\/\//i.test(url);
  return (
    <Stack gap={8}>
      <div className="section-title">Product</div>
      {search && (
        <Button
          component="a"
          href={leroySearchUrl(search)}
          target="_blank"
          rel="noopener noreferrer"
          size="compact-sm"
          variant="default"
          leftSection={<IconSearch size={14} />}
        >
          Find “{search}” on Leroy Merlin
        </Button>
      )}
      <TextInput size="xs" label="Product name" placeholder="As listed in the shop" value={product?.name ?? ''} onChange={(e) => set({ name: e.currentTarget.value })} />
      <TextInput
        size="xs"
        label="Product link"
        placeholder="https://www.leroymerlin.pl/…"
        value={product?.url ?? ''}
        onChange={(e) => set({ url: e.currentTarget.value })}
        error={url && !valid ? 'Paste the full address, starting with https://' : undefined}
      />
      <Group gap={8} align="flex-end" wrap="nowrap">
        <NumberInput
          size="xs"
          label="Price"
          suffix=" zł"
          min={0}
          decimalScale={2}
          hideControls
          value={product?.price ?? ''}
          onChange={(v) => set({ price: typeof v === 'number' ? v : undefined })}
          style={{ flex: 1 }}
        />
        {valid && (
          <Anchor href={url} target="_blank" rel="noopener noreferrer" size="xs" mb={6}>
            Open <IconExternalLink size={12} style={{ verticalAlign: -1 }} />
          </Anchor>
        )}
      </Group>
    </Stack>
  );
}
