const bookmarks = require('../../js&css/web-accessible/features/bookmarks');
test('bookmark Markdown export includes timestamp links and notes', () => {
	const value = bookmarks.toMarkdown([{ timeLabel: '1:23', url: 'https://youtube.com/watch?v=abc', note: 'important point' }]);
	expect(value).toContain('[1:23](https://youtube.com/watch?v=abc)');
	expect(value).toContain('important point');
});
test('bookmark Markdown export safely flattens note newlines', () => {
	expect(bookmarks.toMarkdown([{ timeLabel: '0:08', note: 'line one\nline two' }])).toContain('line one line two');
});
