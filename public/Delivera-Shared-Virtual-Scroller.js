
/**
 * Virtual Scroller for VodaAgileBoard
 * "Speed" Value: Renders 1000s of rows in <16ms frame budget.
 */
export class VirtualScroller {
    constructor(container, items, renderItemFn, options = {}) {
        this.container = container;
        this.items = items;
        this.renderItem = renderItemFn;
        this.rowHeight = options.rowHeight || 50; // Default estimate
        this.buffer = options.buffer || 5;

        this.visibleItems = [];
        this.totalHeight = this.items.length * this.rowHeight;

        this.scroller = document.createElement('div');
        this.scroller.style.height = `${this.totalHeight}px`;
        this.scroller.style.position = 'relative';
        this.scroller.style.overflow = 'hidden';

        this.content = document.createElement('div');
        this.content.style.position = 'absolute';
        this.content.style.width = '100%';
        this.content.style.top = '0';
        this.content.style.left = '0';

        this.container.style.overflowY = 'auto';
        this.container.style.position = 'relative';

        this.scroller.appendChild(this.content);
        this.container.innerHTML = '';
        this.container.appendChild(this.scroller);

        this.container.addEventListener('scroll', () => this.onScroll());

        // Initial Render
        this.onScroll();
    }

    onScroll() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;

        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.floor((scrollTop + viewportHeight) / this.rowHeight) + this.buffer
        );

        this.renderChunk(startIndex, endIndex);
    }

    renderChunk(start, end) {
        // Optimization: Don't re-render if range hasn't changed meaningfully
        // (Omitted for brevity/simplicity in MVP, relying on VVP speed)

        const offset = start * this.rowHeight;
        this.content.style.transform = `translateY(${offset}px)`;

        // Efficient DOM Diffing or HTML replacement
        // For "Simplicity", we assume clean replacement is fast enough for text rows
        const visibleChunk = this.items.slice(start, end + 1);
        this.content.innerHTML = visibleChunk.map((item, idx) => this.renderItem(item, start + idx)).join('');
    }
}
