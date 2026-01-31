"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createOrganization } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";

import { useSearchParams } from "next/navigation";

export default function RegisterPage() {
    return (
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <RegisterForm />
        </React.Suspense>
    );
}

function RegisterForm() {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const searchParams = useSearchParams();
    const [email, setEmail] = useState(searchParams.get("email") || "");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [orgName, setOrgName] = useState("");

    const router = useRouter();
    const { toast } = useToast();
    const supabase = createClient();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Sign up user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Registration failed");

            // 2. Check if we have a session (email confirmation might be disabled)
            if (authData.session) {
                // Create organization immediately
                await createOrganization(orgName || `${fullName}'s Workspace`);

                toast({
                    title: t('auth.register_success'),
                    description: t('auth.redirecting'),
                });
                router.push("/");
            } else {
                // Email confirmation is likely enabled
                toast({
                    title: "Confirmação necessária",
                    description: t('auth.check_email_for_confirmation'),
                });
                router.push("/login");
            }

            router.refresh();
        } catch (err: any) {
            console.error("Registration Error:", err);
            let description = err.message || t('common.error');

            if (err.message?.includes('User already registered')) {
                description = t('auth.email_already_registered');
            }

            toast({
                title: t('auth.register_error'),
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
                    <CardTitle className="text-2xl font-bold tracking-tight text-center">{t('auth.register_title')}</CardTitle>
                    <CardDescription className="text-center text-stone-400">
                        {t('auth.register_subtitle')}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">{t('auth.full_name')}</Label>
                            <Input
                                id="fullName"
                                placeholder="Seu nome"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="bg-stone-950/50 border-stone-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="orgName">{t('auth.org_name')}</Label>
                            <Input
                                id="orgName"
                                placeholder="Ex: Minha Empresa"
                                required
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="bg-stone-950/50 border-stone-800"
                            />
                        </div>
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
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('auth.register_button')}
                        </Button>
                        <div className="text-sm text-center text-stone-400">
                            {t('auth.has_account')}{" "}
                            <Link href="/login" className="text-blue-500 hover:underline">
                                {t('auth.login_link')}
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
