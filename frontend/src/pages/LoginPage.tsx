import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";
import { User, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await api.post("/users/login", {
                username,
                password,
            });
            const { access_token } = response.data;

            // Get user info
            const userResponse = await api.get("/users/me", {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            setAuth(access_token, userResponse.data);
            navigate("/chat");
        } catch (err: any) {
            setError(err.response?.data?.detail || "登录失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-md bg-base border border-surface2 rounded-lg shadow-2xl overflow-hidden"
            >
                {/* Header：编辑纸感（衬线标题 + 小刊号 eyebrow） */}
                <header className="px-8 pt-8 pb-6 border-b border-surface2">
                    <p className="text-[11px] text-subtext0 tracking-[0.2em] uppercase mb-2">AI · 探索</p>
                    <h1 className="font-serif text-3xl text-ctext leading-tight">登录</h1>
                    <p className="text-sm text-subtext1 mt-2">登录以开始你的探索。</p>
                </header>

                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-overlay0 pointer-events-none" />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 bg-base border border-surface2 rounded text-sm text-ctext placeholder:text-overlay0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none transition"
                            placeholder="用户名"
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-overlay0 pointer-events-none" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 bg-base border border-surface2 rounded text-sm text-ctext placeholder:text-overlay0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none transition"
                            placeholder="密码"
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red bg-red/10 border border-red/30 rounded px-3 py-2">
                            {error}
                        </div>
                    )}

                    <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 bg-mauve text-base py-2.5 rounded text-sm font-medium hover:bg-mauve/90 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {loading ? (
                            "登录中…"
                        ) : (
                            <>
                                登录
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </motion.button>
                </form>

                {/* Footer：mantle 分层 + 衬线斜体署名 */}
                <footer className="px-8 py-4 border-t border-surface2 bg-mantle">
                    <p className="text-xs text-subtext0 text-center font-serif italic">AI 探索平台</p>
                </footer>
            </motion.div>
        </div>
    );
}
