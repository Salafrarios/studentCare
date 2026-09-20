"use client";

import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  alpha: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export default function InteractiveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Paleta de verdes do StudentCare
    const greenPalette = [
      "rgba(45, 106, 79, ",   // #2D6A4F - Verde escuro principal
      "rgba(64, 145, 108, ",  // #40916C - Verde médio
      "rgba(82, 183, 136, ",  // #52B788 - Verde vibrante
      "rgba(116, 198, 157, ", // #74C69D - Verde claro
      "rgba(149, 213, 178, ", // #95D5B2 - Verde menta / destaque
    ];

    const mouse = {
      x: -1000,
      y: -1000,
      radius: 170, // Raio de influência do mouse
      isHovered: false,
    };

    const ripples: Ripple[] = [];

    // Densidade adaptável de partículas
    const particleCount = Math.min(Math.floor((width * height) / 11000), 120);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const baseRadius = Math.random() * 2.8 + 1.2;
      const colorBase = greenPalette[Math.floor(Math.random() * greenPalette.length)];
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        radius: baseRadius,
        baseRadius,
        color: colorBase,
        alpha: Math.random() * 0.6 + 0.3,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.isHovered = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.isHovered = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Cria ondulação verde ao clicar
      ripples.push({
        x: clickX,
        y: clickY,
        radius: 5,
        maxRadius: 180,
        alpha: 0.6,
      });

      // Impulso suave nas partículas próximas
      particles.forEach((p) => {
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const dist = Math.hypot(dx, dy);
        if (dist < 200 && dist > 0) {
          const force = (200 - dist) / 200;
          p.vx += (dx / dist) * force * 3;
          p.vy += (dy / dist) * force * 3;
        }
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
        mouse.isHovered = true;
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("click", handleClick);
    window.addEventListener("touchmove", handleTouchMove);

    // Loop de renderização fluida
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Halo sutil ao redor do cursor do mouse em verde
      if (mouse.isHovered && mouse.x > 0 && mouse.y > 0) {
        const gradient = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          mouse.radius
        );
        gradient.addColorStop(0, "rgba(82, 183, 136, 0.18)");
        gradient.addColorStop(0.5, "rgba(64, 145, 108, 0.08)");
        gradient.addColorStop(1, "rgba(45, 106, 79, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ondulações de cliques (ripples)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 3.5;
        r.alpha -= 0.012;

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(82, 183, 136, ${r.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Atualizar e desenhar conexões entre partículas próximas (efeito rede de apoio/sinapse)
      const maxConnectDist = 120;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxConnectDist) {
            const lineAlpha = (1 - dist / maxConnectDist) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(64, 145, 108, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Conexões e interação das partículas com o mouse
      particles.forEach((p) => {
        // Movimento base com atrito
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Mantém velocidade mínima de flutuação
        if (Math.abs(p.vx) < 0.2) p.vx += (Math.random() - 0.5) * 0.1;
        if (Math.abs(p.vy) < 0.2) p.vy += (Math.random() - 0.5) * 0.1;

        // Rebote nas bordas da janela
        if (p.x < 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx);
        } else if (p.x > width) {
          p.x = width;
          p.vx = -Math.abs(p.vx);
        }

        if (p.y < 0) {
          p.y = 0;
          p.vy = Math.abs(p.vy);
        } else if (p.y > height) {
          p.y = height;
          p.vy = -Math.abs(p.vy);
        }

        // Interação física e conexão visual com o mouse
        if (mouse.isHovered) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouse.radius) {
            // Conecta a partícula ao cursor com linha verde brilhante
            const mouseLineAlpha = (1 - dist / mouse.radius) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(82, 183, 136, ${mouseLineAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Atração/interação suave ao mover o mouse por perto
            const angle = Math.atan2(dy, dx);
            const force = (mouse.radius - dist) / mouse.radius;
            p.vx += Math.cos(angle) * force * 0.25;
            p.vy += Math.sin(angle) * force * 0.25;
            p.radius = p.baseRadius * (1 + force * 0.8);
          } else {
            p.radius = p.baseRadius;
          }
        } else {
          p.radius = p.baseRadius;
        }

        // Desenho da partícula
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.shadowColor = "rgba(45, 106, 79, 0.4)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none w-full h-full z-0"
      style={{
        background: "radial-gradient(circle at 50% 30%, rgba(236, 253, 245, 0.8) 0%, rgba(248, 249, 250, 1) 100%)",
      }}
      aria-hidden="true"
    />
  );
}
