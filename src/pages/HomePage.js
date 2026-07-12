import Button from '~/components/Button';

function HomePage() {
  return (
    <div className="p-8 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Smart Home</h1>
      <div className="flex gap-2">
        <Button onClick={() => alert('primary clicked')}>Primary</Button>
        <Button variant="secondary" onClick={() => alert('secondary clicked')}>Secondary</Button>
      </div>
    </div>
  );
}

export default HomePage;
