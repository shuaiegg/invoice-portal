export default function TestPage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-4xl font-bold text-primary">Design System Test</h1>
      <p className="text-text">This should be the main text color.</p>
      <p className="text-secondary-text">This should be the secondary text color.</p>
      <div className="p-4 bg-accent rounded">
        This box should have the accent background.
      </div>
      <p className="text-success">Success message</p>
      <p className="text-warning">Warning message</p>
      <p className="text-error">Error message</p>
    </div>
  );
}
