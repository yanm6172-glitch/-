"""
问题三：最小填充率搜索（二分搜索 + 蒙特卡洛）
找到使导通概率 >= 90% 的最小金属A填充率
基于问题二结果，阈值在 N≈10-50（填充率~0.01%-0.07%）
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')
import time

plt.rcParams['font.sans-serif'] = ['STHeiti', 'SimHei', 'Heiti TC',
    'Arial Unicode MS', 'Hiragino Sans GB', 'PingFang SC',
    'Microsoft YaHei', 'Songti SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 150
plt.rcParams['savefig.bbox'] = 'tight'

from core_geometry import (
    CUBE_SIZE, CUBE_HALF, R_A, L_A, TUNNELING_DIST,
    ELECTRODE_LEFT, ELECTRODE_RIGHT,
    cylinder_to_plane_distance, compute_volume_A,
    generate_random_particle_A, segment_to_segment_distance_3d, UnionFind
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(BASE_DIR, '图片')
OUT_DIR = os.path.join(BASE_DIR, '结果')
os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), '..', '数据')

def despine(ax):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
def save_fig(fig, name):
    fig.savefig(os.path.join(FIG_DIR, name), bbox_inches='tight')
    plt.close(fig)
def save_csv(df, name):
    df.to_csv(os.path.join(OUT_DIR, name), index=False, encoding='utf-8-sig')

# Import optimized check
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '问题二'))
from 问题二_多颗粒蒙特卡洛 import check_conduction_opt

V_A = compute_volume_A()
V_total = CUBE_SIZE ** 3

print("=" * 60)
print("问题三：最小填充率搜索 (目标: >= 90%)")
print("=" * 60, flush=True)

# --- Part 1: 附件3 ---
data_path = os.path.join(DATA_DIR, '附件.xlsx')
df3 = pd.read_excel(data_path, sheet_name=2)
df3.columns = ['X1','Y1','Z1','X2','Y2','Z2']
if str(df3.iloc[0]['X1']).strip() == 'X':
    df3 = df3.iloc[1:].reset_index(drop=True)
for col in df3.columns:
    df3[col] = pd.to_numeric(df3[col])

n3 = len(df3)
fr3 = n3 * V_A / V_total
particles_3 = [(np.array(df3.iloc[i][['X1','Y1','Z1']]),
                np.array(df3.iloc[i][['X2','Y2','Z2']])) for i in range(n3)]
conducts_3 = check_conduction_opt(particles_3)
print(f"附件3: {n3}颗粒, 填充率={fr3:.4%}, 导通={'是' if conducts_3 else '否'}", flush=True)

# --- Part 2: 二分搜索 (N空间，更直观) ---
print("\n--- 二分搜索最小颗粒数 ---", flush=True)
N_low, N_high = 5, 80
search_trials = 200

search_log = []
for iteration in range(15):
    N_mid = (N_low + N_high) // 2
    fr_mid = N_mid * V_A / V_total

    n_conduct = 0
    for _ in range(search_trials):
        parts = [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(N_mid)]]
        if check_conduction_opt(parts):
            n_conduct += 1

    prob = n_conduct / search_trials
    search_log.append({'迭代': iteration+1, 'N下限': N_low, 'N上限': N_high, 'N中点': N_mid,
                       '填充率': f'{fr_mid:.4%}', '导通概率': f'{prob:.4f}'})

    print(f"  迭代{iteration+1}: N=[{N_low},{N_high}], mid={N_mid}, fr={fr_mid:.4%}, prob={prob:.4f}", flush=True)

    if prob >= 0.90:
        N_high = N_mid
    else:
        N_low = N_mid + 1

    if N_low >= N_high:
        break

N_min = N_high
fr_min = N_min * V_A / V_total
print(f"\n最小颗粒数: N_min={N_min}, 对应填充率: {fr_min:.6%}", flush=True)

# --- Part 3: 大样本验证 ---
print("\n--- 大样本验证 ---", flush=True)
verify_trials = 500
n_conduct_v = sum(1 for _ in range(verify_trials)
    if check_conduction_opt([(p[0].copy(), p[1].copy())
        for p in [generate_random_particle_A() for _ in range(N_min)]]))
prob_v = n_conduct_v / verify_trials
std_v = np.sqrt(prob_v*(1-prob_v)/verify_trials)
print(f"验证: {n_conduct_v}/{verify_trials}={prob_v:.4f}+/-{std_v:.4f}", flush=True)
print(f"95%CI: [{prob_v-1.96*std_v:.4f}, {prob_v+1.96*std_v:.4f}]", flush=True)

save_csv(pd.DataFrame([{'最小颗粒数': N_min, '最小填充率': f'{fr_min:.6%}',
    '验证概率': f'{prob_v:.4f}', '标准误差': f'{std_v:.4f}',
    '验证次数': verify_trials, '附件3颗粒数': n3, '附件3填充率': f'{fr3:.4%}',
    '附件3导通': '是' if conducts_3 else '否'}]), '问题三搜索结果.csv')
save_csv(pd.DataFrame(search_log), '二分搜索过程.csv')

# --- Part 4: 精细概率曲线 ---
print("\n--- 精细概率曲线 ---", flush=True)
fine_Ns = list(range(max(2, N_min-15), min(100, N_min+20)))
fine_probs = []
for N in fine_Ns:
    n_c = sum(1 for _ in range(150)
        if check_conduction_opt([(p[0].copy(), p[1].copy())
            for p in [generate_random_particle_A() for _ in range(N)]]))
    fine_probs.append(n_c/150)
    print(f"  N={N}, prob={fine_probs[-1]:.4f}", flush=True)

# --- Part 5: 绘图 ---
# 图1: 二分搜索收敛
fig, ax = plt.subplots(figsize=(8,5))
iters = list(range(1, len(search_log)+1))
N_lows = [s['N下限'] for s in search_log]
N_highs = [s['N上限'] for s in search_log]
N_mids = [s['N中点'] for s in search_log]
ax.fill_between(iters, N_lows, N_highs, alpha=0.3, color='#2c7bb6')
ax.plot(iters, N_mids, 'o-', color='#d7191c', lw=2, ms=8)
ax.set_xlabel('迭代次数'); ax.set_ylabel('颗粒数N')
ax.set_title('二分搜索区间收敛过程')
ax.grid(alpha=0.3, linestyle='--')
despine(ax); save_fig(fig, '二分搜索收敛图.png')

# 图2: 概率曲线
fig, ax = plt.subplots(figsize=(8,5))
ax.plot([n*V_A/V_total*100 for n in fine_Ns], fine_probs, 'o-', color='#2c7bb6', lw=2, ms=6)
ax.axhline(y=0.90, color='#d7191c', ls='--', lw=1.5, label='90%')
ax.axvline(x=fr_min*100, color='#fdae61', ls='--', lw=1.5, label=f'最小={fr_min:.4%}')
ax.set_xlabel('填充率 (%)'); ax.set_ylabel('导通概率')
ax.set_title('导通概率 vs 填充率 (阈值附近)')
ax.legend(); ax.grid(alpha=0.3, linestyle='--')
despine(ax); save_fig(fig, '导通概率vs填充率曲线_精细.png')

# 图3: 粒子数vs概率
fig, ax = plt.subplots(figsize=(8,5))
ax.bar(fine_Ns, fine_probs, color=['#d7191c' if p<0.9 else '#2c7bb6' for p in fine_probs],
       edgecolor='white', lw=0.5)
ax.axhline(y=0.90, color='gray', ls='--', alpha=0.5)
ax.set_xlabel('颗粒数N'); ax.set_ylabel('导通概率')
ax.set_title('导通概率 vs 颗粒数')
ax.set_ylim(0,1.05)
despine(ax); save_fig(fig, '导通概率vs颗粒数.png')

# 图4: 3D分布
fig = plt.figure(figsize=(10,8))
ax = fig.add_subplot(111, projection='3d')
samples = [generate_random_particle_A() for _ in range(min(N_min, 100))]
for p1,p2 in samples:
    ax.plot([p1[0],p2[0]],[p1[1],p2[1]],[p1[2],p2[2]],'b-',alpha=0.3,lw=0.5)
xx,yy = np.meshgrid([-5000,5000],[-5000,5000])
ax.plot_surface(np.full_like(xx,-5000),xx,yy,alpha=0.05,color='blue')
ax.plot_surface(np.full_like(xx,5000),xx,yy,alpha=0.05,color='red')
ax.set_xlabel('X(nm)'); ax.set_ylabel('Y(nm)'); ax.set_zlabel('Z(nm)')
ax.set_title(f'临界配置 N={N_min}, fr={fr_min:.4%}')
save_fig(fig, '临界填充率3D分布.png')

# 图5: 迭代概率
fig, ax = plt.subplots(figsize=(8,5))
iter_probs = [float(s['导通概率']) for s in search_log]
colors = ['#d7191c' if p<0.9 else '#2c7bb6' for p in iter_probs]
ax.bar(iters, iter_probs, color=colors, edgecolor='white')
ax.axhline(y=0.90, color='gray', ls='--', alpha=0.5)
ax.set_xlabel('迭代'); ax.set_ylabel('导通概率')
ax.set_title('各迭代导通概率'); ax.set_ylim(0,1.05)
despine(ax); save_fig(fig, '迭代导通概率图.png')

print(f"\n最终结论: 最小填充率 = {fr_min:.6%}, N_min = {N_min}")
print(f"结果已保存至 {OUT_DIR}")
print("问题三求解完成！", flush=True)
