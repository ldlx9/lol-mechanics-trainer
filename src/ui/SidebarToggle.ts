/** 只改变界面布局，隐藏数据栏时训练与统计继续运行。 */
export function mountSidebarToggle(onLayoutChange: () => void): () => void {
  const arena = document.getElementById('arena')!;
  const panel = document.getElementById('training-sidebar')!;
  const button = document.getElementById('sidebar-toggle')!;
  let layoutFrame = 0;
  const toggle = (): void => {
    const collapsed = !panel.hidden;
    panel.hidden = collapsed;
    arena.classList.toggle('sidebar-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.textContent = collapsed ? '‹ 展开数据栏' : '收起数据栏 ›';
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(onLayoutChange);
  };
  button.addEventListener('click', toggle);
  return () => {
    cancelAnimationFrame(layoutFrame);
    button.removeEventListener('click', toggle);
  };
}
