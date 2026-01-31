"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export default function LoginPage() {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const router = useRouter();
    const { toast } = useToast();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast({
                title: t('auth.login_success'),
                description: t('auth.welcome_back'),
            });

            router.push("/");
            router.refresh();
        } catch (err: any) {
            console.error("Login Error:", err);
            let description = err.message || t('auth.invalid_credentials');

            if (err.code === 'email_not_confirmed' || err.message?.includes('Email not confirmed')) {
                description = t('auth.check_email_for_confirmation');
            }

            toast({
                title: t('auth.login_error'),
                description: description,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-transparent p-4">
            <Card className="w-full max-w-md bg-stone-900/50 backdrop-blur-xl border-stone-800 shadow-2xl">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight text-center">{t('auth.login_title')}</CardTitle>
                    <CardDescription className="text-center text-stone-400">
                        {t('auth.login_subtitle')}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">{t('auth.email')}</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-stone-950/50 border-stone-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">{t('auth.password')}</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-stone-950/50 border-stone-800"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-10" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('auth.login_button')}
                        </Button>
                        <div className="text-sm text-center text-stone-400">
                            {t('auth.no_account')}{" "}
                            <Link href="/register" className="text-blue-500 hover:underline">
                                {t('auth.create_account')}
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
