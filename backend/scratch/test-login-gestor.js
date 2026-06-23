const res = await fetch('http://127.0.0.1:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'gestor.prueba@tramitesvehicularesdemexico.com',
    password: '123456',
  }),
});
const data = await res.json();
console.log(res.status, JSON.stringify(data, null, 2));
