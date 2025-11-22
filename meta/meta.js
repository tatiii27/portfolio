import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let xScale;
let yScale;

let allCommits = [];
let filteredCommits = [];

const colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
    const data = await d3.csv('loc.csv', row => ({
        ...row,
        line: +row.line, 
        depth: +row.depth, 
        length: +row.length,
        date: new Date(row.date+'T00:00'+row.timezone),
        datetime:new Date(row.datetime),
    }));
    return data;

}

function processCommits(data) {
    const commits = d3.groups(data, d=>d.commit).map(([commit, lines]) => {
        const { author, date, time, timezone, datetime } = lines[0];
        const ret = {
            id: commit,
            url: 'https://github.com/tatiii27/portfolio/commit/' + commit,
            author, 
            date, 
            time, 
            timezone, 
            datetime,
            hourFrac: datetime.getHours() + datetime.getMinutes()/60,
            totalLines: lines.length
        };
        Object.defineProperty(ret, 'lines', { 
            value:lines, 
            writable:false, 
            configurable:false, 
            enumerable:false 
        });
        return ret;
    });

    return d3.sort(commits, d => d.datetime);

}



function renderCommitInfo(data, commits){
    const totalLOC = data.length;
    const filesCount = d3.group(data, d => d.file).size;
             
    const longestLineChars = d3.max(data, d => d.length ?? 0) ?? 0;      
    const linesPerFile = d3.rollup(data, v => v.length, d => d.file);
    const maxLinesInAFile = d3.max(linesPerFile.values()) ?? 0; 

    const root = d3.select('#stats');
    root.selectAll('*').remove();

    const card = root.append('div').attr('class','stats-card');
    const grid = card.append('div').attr('class','stats-grid');

   
    const add = (label, value, sub='') => {
        const s = grid.append('div').attr('class','stat');
        s.append('div').attr('class','label').text(label);
        s.append('div').attr('class','value').text(value);
        if (sub) s.append('div').attr('class','sub').text(sub);
    };
    add('FILES', filesCount);
    add('TOTAL LOC', totalLOC);
    add('LONGEST LINE', longestLineChars, 'characters');
    add('MAX LINES', maxLinesInAFile, 'in a single file');

}

const commit_tooltip = document.getElementById('commit-tooltip');
const commit_link = document.getElementById('commit-link');
const commit_date = document.getElementById('commit-date');
const commit_time = document.getElementById('commit-time');
const commit_author = document.getElementById('commit-author');
const commit_lines = document.getElementById('commit-lines');
const selection_count = document.getElementById('selection-count');
const language_breakdown = document.getElementById('language-breakdown');


function renderTooltipContent(c){
    if (!c) return;
    commit_link.href = c.url; 
    commit_link.textContent = c.id.slice(0,7);
    commit_date.textContent = c.datetime?.toLocaleString('en',{
        dateStyle:'full'
    });
    commit_time.textContent = c.datetime?.toLocaleTimeString('en',{
        hour:'2-digit',
        minute:'2-digit'
    });
    commit_author.textContent = c.author ?? '—';
    commit_lines.textContent = c.totalLines ?? 0;  
}

function updateTooltipVisibility(v){ 
    commit_tooltip.hidden = !v; 
}
function updateTooltipPosition(ev){
    const pad=12; 
    commit_tooltip.style.left = `${ev.clientX+pad}px`; 
    commit_tooltip.style.top = `${ev.clientY+pad}px`;
}

function renderScatterPlot(data, commits){
    const container = document.getElementById('chart');
    const width=Math.min(960, (container.clientWidth || 960));
    const height=420;
    const margin={top:10,right:10,bottom:30,left:40};
    const usableArea={
        left:margin.left,
        right:width-margin.right,
        top:margin.top,
        bottom:height-margin.bottom,
        width:width-margin.left-margin.right,
        height:height-margin.top-margin.bottom
    };

    const svg=d3
        .select('#chart')
        .append('svg')
        .attr('viewBox',`0 0 ${width} ${height}`)
        .style('overflow','visible');

    xScale=d3
        .scaleTime()
        .domain(d3.extent(commits,d=>d.datetime))
        .range([usableArea.left,usableArea.right])
        .nice();
        
    yScale=d3
        .scaleLinear()
        .domain([0,24])
        .range([usableArea.bottom,usableArea.top]);
      

    const gridlines = svg
        .insert('g', ':first-child')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(
            d3
                .axisLeft(yScale)
                .tickFormat('')
                .tickSize(-usableArea.width)
                .ticks(12)
        );

    gridlines.select('.domain').remove()
    gridlines.selectAll('line')
        .style('stroke', 'var(--chart-grid)')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 1)
        .attr('shape-rendering', 'crispEdges');
    const xAxisG = svg.append('g')
        .attr('class', 'x-axis axis--x')
        .attr('transform',`translate(0,${usableArea.bottom})`)
        .call(d3.axisBottom(xScale));
        
    xAxisG.select('.domain')
        .style('stroke','var(--chart-axis)')
        .attr('stroke-width', 2)

    const yAxisG = svg.append('g')
        .attr('class', 'axis axis--y')
        .attr('transform',`translate(${usableArea.left},0)`)
        .call(d3.axisLeft(yScale)
            .tickFormat(d=>String(d%24).padStart(2,'0')+':00'));

    yAxisG.select('.domain')
        .style('stroke', 'var(--chart-axis)')
        .attr('stroke-width', 2)
        .attr('opacity', 1);

        
    yAxisG.selectAll('.tick line')
        .attr('opacity', 0);

    svg.append('line')
        .attr('x1', usableArea.left)
        .attr('x2', usableArea.right)
        .attr('y1', usableArea.top)
        .attr('y2', usableArea.top)
        .attr('stroke', 'var(--chart-axis)')
        .attr('stroke-width', 2)
        .attr('shape-rendering', 'crispEdges');


    const [minL,maxL]=d3.extent(commits,d=>d.totalLines);
    const rScale=d3.scaleSqrt().domain([minL ?? 0,maxL ?? 1]).range([2,16]);

    const sorted=d3.sort(commits,d=>-(d.totalLines??0));
    const dots=svg.append('g').attr('class','dots');

    dots.selectAll('circle')
        .data(sorted, d => d.id)
        .join('circle')
        .attr('cx',d=>xScale(d.datetime))
        .attr('cy',d=>yScale(d.hourFrac))
        .attr('r',d=>rScale(d.totalLines))
        .attr('fill','#FF86B6')
        .style('fill-opacity',.7)
        .on('mouseenter',(ev,d)=>{ 
            d3.select(ev.currentTarget).style('fill-opacity',1); 
            renderTooltipContent(d); 
            updateTooltipVisibility(true); 
            updateTooltipPosition(ev);
        })
        .on('mousemove',updateTooltipPosition)
        .on('mouseleave',(ev)=>{ 
            d3.select(ev.currentTarget).style('fill-opacity',.7); 
            updateTooltipVisibility(false); 
        });
    function isCommitSelected(sel,d){
        if(!sel) return false;
        const [[x0,y0],[x1,y1]]=sel; const x=xScale(d.datetime), y=yScale(d.hourFrac);
        return x0<=x && x<=x1 && y0<=y && y<=y1;
    }
    function renderSelectionCount(sel){
        const selected = sel ? commits.filter(d=>isCommitSelected(sel,d)) : [];
        selection_count.textContent = `${selected.length||'No'} commits selected`;
        return selected;
    }
    function renderLanguageBreakdown(sel){
        const selected = sel ? commits.filter(d=>isCommitSelected(sel,d)) : [];
        language_breakdown.innerHTML = '';
        if (!selected.length) return;
        const lines = selected.flatMap(d=>d.lines);
        const breakdown = d3.rollup(lines, v=>v.length, d=>d.type);
        for (const [lang,count] of breakdown){
        const p = count/lines.length; const pct=d3.format('.1~%')(p);
        language_breakdown.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${pct})</dd>`;
        }
    }
    function brushed(ev){
        const sel=ev.selection;
        svg.selectAll('circle').classed('selected',d=>isCommitSelected(sel,d));
        renderSelectionCount(sel); 
        renderLanguageBreakdown(sel);
    }

    const brush = d3.brush()
        .extent([[usableArea.left, usableArea.top],
            [usableArea.right, usableArea.bottom]])
        .on('start brush end', brushed);
    
    svg.append('g')
            .attr('class', 'brush')
            .call(brush)

    svg.selectAll('.dots, .overlay ~ *').raise();
        

}

function updateScatterPlot(data, commits) {
    const svg = d3.select('#chart').select('svg');
    if (svg.empty()) return;

    xScale.domain(d3.extent(allCommits, d => d.datetime)).nice();

    const [minL, maxL] = d3.extent(allCommits, d => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minL ?? 0, maxL ?? 1]).range([2, 16]);
        
    const xAxis = d3.axisBottom(xScale);
    const xAxisG = svg.select('g.x-axis');
    xAxisG.call(xAxis);

    const sorted = d3.sort(commits, d => -(d.totalLines ?? 0));
    const dots = svg.select('g.dots');

    dots.selectAll('circle')
        .data(sorted, d => d.id)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .attr('fill', '#FF86B6')
        .style('fill-opacity', .7)
        .on('mouseenter', (ev, d) => {
            d3.select(ev.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(d);
            updateTooltipVisibility(true);
            updateTooltipPosition(ev);
        })
        .on('mousemove', updateTooltipPosition)
        .on('mouseleave', (ev) => {
            d3.select(ev.currentTarget).style('fill-opacity', .7);
            updateTooltipVisibility(false);
        });



}


function updateFileDisplay(filteredCommits) {

    const lines = filteredCommits.flatMap(d => d.lines);

    const files = d3
        .groups(lines, d => d.file)
        .map(([name, lines]) => ({ name, lines }))
        .sort((a, b) => b.lines.length - a.lines.length);

        
    const filesContainer = d3
        .select('#files')
        .selectAll('div')
        .data(files, d => d.name)
        .join(
            enter => 
                enter.append('div').call(div => {
                    div.append('dt').append('code');
                    div.append('dd');
                })
            );
    filesContainer
        .select('dt')
        .html(d => `
            <code>${d.name}</code>
            <small>${d.lines.length} lines</small>
        `);
    filesContainer
        .select('dd')
        .selectAll('div')
        .data(d => d.lines)
        .join('div')
        .attr('class', 'loc')
        .style('background', line => colors(line.type));
}

const page = document.getElementById('page');
const nav = document.querySelector('nav');
if (page && nav) {
    const pad = nav.offsetHeight + 12;
    page.style.paddingTop = pad + 'px';
}


const data = await loadData();
const commits = processCommits(data);
allCommits = commits;

filteredCommits = commits.slice(0,1);

renderCommitInfo(data, commits);
renderScatterPlot(data, allCommits);
document.getElementById('commit-tooltip').hidden = true;
updateScatterPlot(data, filteredCommits);
updateFileDisplay(filteredCommits);



const storyHTML = (d, i) => `
    <p>
        On <strong>${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
        })}</strong>,
        I made <a href="${d.url}" target="_blank" rel="noopener noreferrer">
        ${i > 0 ? 'another glorius commit': 'my first glorius commit'}
        </a>,
    </p>
    <p>
        I edited <strong>${d.totalLines}</strong> lines across
        <strong>${
            d3.rollups(
                d.lines,
                D => D.length,
                l => l.file,
            ).length
        }</strong> files.
    </p>
`;

d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(storyHTML); 

d3.select('#file-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(storyHTML); 



function onScatterStepEnter({ index }) {
    const upto = commits.slice(0, index + 1);
    filteredCommits = upto;

    updateScatterPlot(data, filteredCommits);
    
}

function onFilesStepEnter({ index }) {
    const upto = commits.slice(0, index + 1);
    updateFileDisplay(upto);
}


const scroller1 = scrollama();
scroller1
    .setup({
        container: '#scrolly-1',
        step: '#scrolly-1 .step',
        offset: 0.5,
    })
    .onStepEnter(onScatterStepEnter);

const scroller2 = scrollama();
scroller2
    .setup({
        container: '#scrolly-2',
        step: '#scrolly-2 .step',
        offset: 0.5,
    })
    .onStepEnter(onFilesStepEnter);
    
