"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/lib/stores/authStore';
import { useShopStore } from '@/lib/stores/shopStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { auth } from '@/lib/firebase/config';
import { LogOut } from 'lucide-react';

const schema = z.object({
  a4: z.object({ singleBW: z.coerce.number(), doubleBW: z.coerce.number(), singleColor: z.coerce.number(), doubleColor: z.coerce.number() }),
  a3: z.object({ singleBW: z.coerce.number(), doubleBW: z.coerce.number(), singleColor: z.coerce.number(), doubleColor: z.coerce.number() }),
  services: z.object({ softBinding: z.coerce.number().optional(), hardBinding: z.coerce.number().optional(), spiralBinding: z.coerce.number().optional(), emergency: z.coerce.number().optional() })
});

type FormValues = z.infer<typeof schema>;

export default function ShopfrontProfilePage() {
  const { user } = useAuthStore();
  const { currentShop, fetchShopData, updatePricing } = useShopStore();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: currentShop?.pricing ?? {
      a4: { singleBW: 0, doubleBW: 0, singleColor: 0, doubleColor: 0 },
      a3: { singleBW: 0, doubleBW: 0, singleColor: 0, doubleColor: 0 },
      services: { softBinding: 0, hardBinding: 0, spiralBinding: 0, emergency: 0 }
    }
  });

  useEffect(() => {
    if (!user?.uid) return;
    void fetchShopData(user.uid);
  }, [user?.uid, fetchShopData]);

  useEffect(() => {
    if (currentShop?.pricing) form.reset(currentShop.pricing as any);
  }, [currentShop?.pricing, form]);

  const onSubmit = async (values: FormValues) => {
    await updatePricing(values as any);
  };

  const logout = async () => { await auth.signOut(); };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <Tabs defaultValue="a4" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="a4">A4 Pricing</TabsTrigger>
          <TabsTrigger value="a3">A3 Pricing</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TabsContent value="a4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold">A4 Paper Pricing</CardTitle>
                  <CardDescription>Set your prices for A4 paper printing</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <FormField name="a4.singleBW" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Single-sided Black & White</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="a4.doubleBW" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Double-sided Black & White</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="a4.singleColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Single-sided Color</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="a4.doubleColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Double-sided Color</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="a3">
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold">A3 Paper Pricing</CardTitle>
                  <CardDescription>Set your prices for A3 paper printing</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <FormField name="a3.singleBW" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Single-sided Black & White</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="a3.doubleBW" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Double-sided Black & White</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="a3.singleColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Single-sided Color</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="a3.doubleColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Double-sided Color</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="services">
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold">Additional Services</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <FormField name="services.softBinding" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Soft Binding</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="services.hardBinding" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Hard Binding</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="services.spiralBinding" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Spiral Binding</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="services.emergency" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Emergency Printing</FormLabel>
                      <FormControl>
                        <Input className="h-9" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </Form>
      </Tabs>

      <Button onClick={logout} variant="destructive" className="w-full"><LogOut className="h-4 w-4 mr-2" />Logout</Button>
    </div>
  );
}


