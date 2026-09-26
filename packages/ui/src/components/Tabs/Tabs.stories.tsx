import type { Story } from '@ladle/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

export const Basic: Story = () => (
  <Tabs defaultValue="scene" className="max-w-sm">
    <TabsList>
      <TabsTrigger value="scene">Cena</TabsTrigger>
      <TabsTrigger value="grammar">Gramática</TabsTrigger>
    </TabsList>
    <TabsContent value="scene">Áudio da cena aqui.</TabsContent>
    <TabsContent value="grammar">Explicação da estrutura aqui.</TabsContent>
  </Tabs>
);
