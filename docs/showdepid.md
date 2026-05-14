Я хочу чтобы ты в расширение добавил скрытие ненужных depid в элементе, надо оставить только следующие:
61,16,62,24,14,60,39,43,88,86,89,87,69,70,82,72,68,41,19,11,66,83,6,36,34,32,28,29,56,27,30,31,35,37,33,38,81,40,67,59,12
А под вводом управления внедри переключатель "Показать скрытые департаменты"
Вот элемент
<ul class="dropdown-menu pull-right" style="max-height: calc(100vh - 100px); overflow: hidden;">

      <ul class="dropdown-content">
        <li class="dropdown-menu-header"><input placeholder="Введите управление" id="search-department-field" type="text" style=""></li>
        <ul class="dropdown-menu-sub show-depid" style="overflow: auto; max-height: calc(100vh - 136px);">

                                                <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/61/big-debtors/page?token=eyJpdiI6IlFlRkc2V2gydnpvYUVacWhKQVJuUGc9PSIsInZhbHVlIjoiSm9VTFlBTWpHVUVBSWk2cko3WU5QZz09IiwibWFjIjoiYzY3NGJmYTljMzU5M2ExNWJlZmZkMDc0OGE2YzM3NmE2ZGM0NjNkNmU4MDQ3N2Q3MjA5NWVkZjZkOTY3ZmMyMCJ9&amp;section=search" class="department-switch " data-depid="61">
                            г.Ишим (СУЭНКО)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/16/big-debtors/page?token=eyJpdiI6IkJ4dFh4VHdyWjYzb1lDd1Awam0zRFE9PSIsInZhbHVlIjoiU2NIWE5xWHp2bHlGaU9oN3k1K2tJZz09IiwibWFjIjoiZDI1N2E0YzdjMWI5ZTk3OWI0MDlhMmMzZjNjNDg0NWEzZWY2Yzc0ZmU2NjBhMTUyY2VlMzI1NmE1NzYxYzI1YyJ9&amp;section=search" class="department-switch " data-depid="16">
                            г.Ишим и Ишимский район
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/62/big-debtors/page?token=eyJpdiI6ImREWjA4WmNJXC9CdytPU0FHcENJRjNnPT0iLCJ2YWx1ZSI6InVGSStnd25DRk5XUFFjQU5rTmFlOEE9PSIsIm1hYyI6ImY3Mzk1OTQxMzMyNDQ3NjNiZjAwNTM5ZDE4OTY5NTA2NTUwZGMyZThiOWYxYWUzODhhNWE2Yzg5YjE5NTljZjEifQ%3D%3D&amp;section=search" class="department-switch " data-depid="62">
                            Д. Дударева
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/24/big-debtors/page?token=eyJpdiI6IlFSd2FVMXNkQXBcL2R0eVY3cjd6SFJBPT0iLCJ2YWx1ZSI6ImFhM2NDNmxmUm9VbzlTTnhuXC9LSFNRPT0iLCJtYWMiOiIwNDlkZWUwMDczODU3N2U0OWJlNzFmMTNiMmJkY2I5YzI2NGVjZjE0Mzg5NTU0ZTdjNTRhZmU1ZWU5YzcyZDgwIn0%3D&amp;section=search" class="department-switch " data-depid="24">
                            Демьянка
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/63/big-debtors/page?token=eyJpdiI6IldUM1RaT1ZGSGtHQ1VLUDQxWUxhUkE9PSIsInZhbHVlIjoibUtybVwvcTc4WXVrSGtUTkp1Q3ROXC93PT0iLCJtYWMiOiIxOTBhN2ZjOTdhZjA2NmZmNmY2ZGUzZTcxZDNlODg4MGM5ZGIyMjlhYWZkNjM0YTEwN2NhZDBhOThhMjUwZjEyIn0%3D&amp;section=search" class="department-switch " data-depid="63">
                            ЖСК №32
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/14/big-debtors/page?token=eyJpdiI6IjNBM1JSTVwvSEUzRDVxVXRUVXR1V0ZRPT0iLCJ2YWx1ZSI6InpEb0NacERHZE5USDJxQVVBMk5PMkE9PSIsIm1hYyI6IjJkOWEzYjU3NzgxNWJjM2Y3ZTlhZDQxZDEzMGYwODRjODJhMzQ3MzFhYTgzN2RmZDM0NDBhNzg0OGVlYTBiM2EifQ%3D%3D&amp;section=search" class="department-switch " data-depid="14">
                            Заводоуковский участок
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/60/big-debtors/page?token=eyJpdiI6IjhCVlh1bURFTkFWSTNoN2R6TFFkMnc9PSIsInZhbHVlIjoiMXFHcnZkV2x2NXhRdm1HR1dUSUtwUT09IiwibWFjIjoiMmRiYmYwMjA1MzljMTg2Y2Y2MDc0NTNkZjQyMjkzMTI5MWFmY2UyYzY4YmFhNGZhNTkzOWQ3ZGI3MGYyMzQ3NiJ9&amp;section=search" class="department-switch " data-depid="60">
                            Заводоуковский участок(СУЭНКО)
                        </a>
                    </li>
                                    <li>
                        <a href="https://kgn.pyramid.vostok-electra.ru/login/department/39/big-debtors/page?token=eyJpdiI6IlFDTmd6cWtrU1NwYzJIcEFlajhYWVE9PSIsInZhbHVlIjoiZ1RmSnE2MTNKWFhRV0pMOVIrS0plZz09IiwibWFjIjoiZWUzMTQ4ODYzZTE1NTVlYjg0ZWM4NDNjZWNhNTE4ZTU4ZTdkOTM3ZGVhOGI3MjBkZGFlZDE2MTk0NjlkMDBiNyJ9&amp;section=search" class="department-switch " data-depid="39">
                            Курган
                        </a>
                    </li>
                                    <li>
                        <a href="https://kgn.pyramid.vostok-electra.ru/login/department/43/big-debtors/page?token=eyJpdiI6IjJLNkJJM0NURGRTclFmcVwvUCtZaWZRPT0iLCJ2YWx1ZSI6Imx3UnZ1bFUrR3JvN2VMdWVqWnZiTHc9PSIsIm1hYyI6IjI4NGUyMjlmNzgwODNjODFlNjQxZTI4YjkyNmY4MDE0MzVmYmQwNDU5NTUxMmI5NTg5MmFlMWRkOTI2Yzg4MzQifQ%3D%3D&amp;section=search" class="department-switch " data-depid="43">
                            Курган-Восточный
                        </a>
                    </li>
                                    <li>
                        <a href="https://kgn.pyramid.vostok-electra.ru/login/department/71/big-debtors/page?token=eyJpdiI6IlFKU1oyNDIrSEg0VjVrZE9QZ01Yenc9PSIsInZhbHVlIjoiVjFnekM1dDVsTVV4SHZta0NKblVUUT09IiwibWFjIjoiMDlmODM0MGJhZDU4OTNiOTc3YWFkODc1MmRmNzI1YTA1MzJmZGVlMDdkYWVjYTRmNDBkYzI3OWY0MTE5N2IwZCJ9&amp;section=search" class="department-switch " data-depid="71">
                            МКП Водоканал
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/84/big-debtors/page?token=eyJpdiI6IlBmVUZINjFPQzNJZU5HKzJRWjB2TlE9PSIsInZhbHVlIjoieWNmVkhUTEtQS2JMWitMeFhZZmkyZz09IiwibWFjIjoiMWJmY2ZiZGRiZjM4YTg4ODdlZDNhNTY3OTk3MTIyZTUzYWExNTM0NTQzM2MyOWYzZmVhOTMzMzgxZWU5ZWRiMyJ9&amp;section=search" class="department-switch " data-depid="84">
                            НО "Фонд капитального ремонта МКД ТО"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/88/big-debtors/page?token=eyJpdiI6Iitwd1p0dXc5ajREOHF5YmFWZlwvaFdRPT0iLCJ2YWx1ZSI6IjZRN3NyblIyNW1SWEp0eFpnd243bGc9PSIsIm1hYyI6ImVjMGM2MWRiYjg4YThhYTM4Yzk1ZDhiYzdiM2Y5ZGE3Y2YxNWQwY2YxZWMyNGFhMWY5NjM3YzU2Yjc1N2NhZDIifQ%3D%3D&amp;section=search" class="department-switch " data-depid="88">
                            Объединенный Восток Тюменский
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/86/big-debtors/page?token=eyJpdiI6IlA3MkZNYkIzcGZUODdrNmFaMDY3eVE9PSIsInZhbHVlIjoiamJUUGdhUklBZ1o3c3laK1JGajBDZz09IiwibWFjIjoiMDE0MjBmNjM4NWRlNmI5OTM5MmRkOWJlMzQ4NGU0MzQxZDA4ZGQyYThiYmQ4YmVjZTRhMjkyMWM2NTNhM2IzNSJ9&amp;section=search" class="department-switch " data-depid="86">
                            Объединенный ЕРИЦ
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/89/big-debtors/page?token=eyJpdiI6Ikh5WFFFYkRFTHc1RDRLMlRENExneXc9PSIsInZhbHVlIjoib1V0TmVHaE01d2U5RnFZMGg2SFo4Zz09IiwibWFjIjoiYzU3OGQyNDVkNjI0NmUwZmMzMWYyNTQzZTI5YzYyNTlkZmRlN2JkNzA2MzJiZDI3ZGI5ZTA2Yzg4OTExNzJkNiJ9&amp;section=search" class="department-switch " data-depid="89">
                            Объединенный Курган
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/87/big-debtors/page?token=eyJpdiI6IjVJVG5mV0NiZlV1SGU2VHNFcWwzdkE9PSIsInZhbHVlIjoiaDVmTkFuamZNXC9cLzB6eGJiNHV4UXNRPT0iLCJtYWMiOiI2ZjExZDljMmI4YmRkYjJiODViN2Q5MWQxYThlOTk5NGZjYmRmMjY2YzA2NTllYjNkYjRjZDcxNmVhYTgxNzVjIn0%3D&amp;section=search" class="department-switch " data-depid="87">
                            Объединенный РИЦ
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/51/big-debtors/page?token=eyJpdiI6InhKS0dRbllUY1JtOHVNdVZUYzBVYWc9PSIsInZhbHVlIjoieHh6TGVsRWZXdXBxZ1BjOHlHbEI5UT09IiwibWFjIjoiY2NjM2JhYTI2NWY5YWRkMjMyYmU5ZWNmNjI4ZGZkY2Y2MjViYzkyYWFiNDU3NTIyZDNkY2E3OTVjMGQ1MzM3ZSJ9&amp;section=search" class="department-switch " data-depid="51">
                            ООО "ЖилсервисУют" (жилфонд)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/58/big-debtors/page?token=eyJpdiI6IlN1Sm5tRkF0eXQ3M3NKNlJyNHVwdVE9PSIsInZhbHVlIjoiT3pkcG0xcmVCUHhUVUxjVndDREpOUT09IiwibWFjIjoiZmEyYzM1ZmY4Y2Y0Y2ExYzU4ZTgzMTExZWE5Mzk0OWMzMjgyNjBiN2I1ZDAwODVhNGFlOTNkYWYxMGI2NjU1ZiJ9&amp;section=search" class="department-switch " data-depid="58">
                            ООО "ЖЭУ №9"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/47/big-debtors/page?token=eyJpdiI6IjU5K2UxNXFaNGFJR1h0V3RzTWxuZFE9PSIsInZhbHVlIjoiRVJUNjhYNTZGRDRwUGxpZmhxY0gxZz09IiwibWFjIjoiZTMwNjFmZDg4YWQzY2IxNWVmODRlYWFmNjZhNzA5MWIwYzhlNDM3MDk3NTFlMDc5NGRhMzgzNzNhMWM3Y2JlNSJ9&amp;section=search" class="department-switch " data-depid="47">
                            ООО "ЗапСибУК"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/69/big-debtors/page?token=eyJpdiI6IjNibUFlNmZCSEtWRERQWjN3YUtSUGc9PSIsInZhbHVlIjoidmZzVExQZTE5MUJHK2htNE8wUXF1QT09IiwibWFjIjoiMzRiODEwYmMxMjA0MDM5YmJiNjA2YzJhZmMxM2M4ODE5M2VlMDVlYTQ5YTE5MzY3YjA0MDM3M2ZhM2NlYmE2NyJ9&amp;section=search" class="department-switch " data-depid="69">
                            ООО "Компания «РИФЕЙ»
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/52/big-debtors/page?token=eyJpdiI6ImhzYTRxYUh3RWFpZ251UVhpNUxPa0E9PSIsInZhbHVlIjoiRlVxOWltYXpOSW1taVJWSnRpYW05QT09IiwibWFjIjoiZWRkYWYwODRjZGQ3ZDQyOTg1N2E4N2FhZWU3ZjliMDM5MjljYjk0MWE3N2IzNDhlM2Q5Y2NmNzY2NDk5ZjBjNyJ9&amp;section=search" class="department-switch " data-depid="52">
                            ООО "Комфортный дом"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/26/big-debtors/page?token=eyJpdiI6IjRpSHFibjZheFwvcXh5cU1lRGQ0M0pBPT0iLCJ2YWx1ZSI6IlRxVDdCVzlcL1g0YWF6cURiczIyM0V3PT0iLCJtYWMiOiJlY2JiNGZjMTE2YWM0NTY4OTgyNDBjMzBhMzM3ZGJiZDBhYmU5Y2MxMTM3NmY1MjMwMDVjNzA1OTYyMTVmMjhmIn0%3D&amp;section=search" class="department-switch " data-depid="26">
                            ООО "Тюменьремстрой"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/55/big-debtors/page?token=eyJpdiI6IkRqRDZPYXArXC80YXJMaDF2ZlUxbjl3PT0iLCJ2YWx1ZSI6IllNZGt0TnNud2xWR0xHTjJaQmpWRmc9PSIsIm1hYyI6Ijg5YWIzODI1ZDY2Y2EzN2JhNjZmY2VjZjcxOGFjZTgzNGEwMzQxZGI3ZTA0ODkxZDAwMjgwMzlkMGY3MTQzY2MifQ%3D%3D&amp;section=search" class="department-switch " data-depid="55">
                            ООО "Тюменьремстрой"_2
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/45/big-debtors/page?token=eyJpdiI6IkZMazhuZzQ2anNKMmdOMVhJOGxNZlE9PSIsInZhbHVlIjoiM3JqTElCZnI5elJ0cE5YcElPWDNUQT09IiwibWFjIjoiZjExOGRiOTk1MTJkOTNlYzk3ZDk3ODBjZDY3NjIzNjNkODM1MTNiOGI1MTdjYzdjZTdiYjQyYmEwNjkxOWJjMiJ9&amp;section=search" class="department-switch " data-depid="45">
                            ООО "УК "Север" (жил.фонд)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/44/big-debtors/page?token=eyJpdiI6ImFyaGlzT0ZKSW9lZVMzWEdSUWVPclE9PSIsInZhbHVlIjoiQWxcL0ZDN2pCSlppUkY0T2dJcUl0N2c9PSIsIm1hYyI6Ijk1MzNjZWM1OTcyZGU2Mzg2MmY3ZTE1MTNiNTE2MjNhMWNiNWVkMTQ0NWJkYWE4NmIwOTQ5ZGFkYTBlNTJhNmMifQ%3D%3D&amp;section=search" class="department-switch " data-depid="44">
                            ООО "УК "Юг"" (жил. фонд)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/46/big-debtors/page?token=eyJpdiI6IndrZnBlWUloRDBSQnhmTVB4YkFvdXc9PSIsInZhbHVlIjoiYURvdjc4ZWh2d3h1RTA1Q0VqZEVMQT09IiwibWFjIjoiZjFhYmZjMWIwZjBhMDZjYWU3MTA0ZWM1YmI0ZWEyNWYwYmZjZjliNTRkNjM5MWFkNDBiMzVmMzkyZjZiMTZhZiJ9&amp;section=search" class="department-switch " data-depid="46">
                            ООО "Уют" (жил.фонд)
                        </a>
                    </li>
                                    <li>
                        <a href="https://yuric.pyramid.vostok-electra.ru/login/department/70/big-debtors/page?token=eyJpdiI6IjNrRk8ySk8yUklxd3hkV2VOQ3U1QUE9PSIsInZhbHVlIjoiMzNIRmtaTDdUTkc5V1wvU1NLYXZMS2c9PSIsIm1hYyI6IjhmZWE1OWYwYjM2NTFjZjRjY2IwOGNiMWQ1MDYyNDI2OGY0ZTBhMTM5NGYzYmIwMTEyYzUyN2ZmYzNiOWU2MjMifQ%3D%3D&amp;section=search" class="department-switch " data-depid="70">
                            ООО "ЮРИЦ"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/82/big-debtors/page?token=eyJpdiI6IlVsNzY0c2tEdUVvNDBoRFFvUWxXdXc9PSIsInZhbHVlIjoiQVwvUFZIeE55bjdKek1qdkJzUjFlS2c9PSIsIm1hYyI6ImUwOTBiMjc4MjdjY2Q5ZTkxN2RkZTczNTgyMGY0MDZhNzUzZmM2NDlhZTY3MjY2NTc5NmU0YTFkN2Q0ZTRhMDYifQ%3D%3D&amp;section=search" class="department-switch " data-depid="82">
                            ООО «ТКС»
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/72/big-debtors/page?token=eyJpdiI6IkpBZ0ZqaVM2WE50Z0g1R0pKNklLRFE9PSIsInZhbHVlIjoiQjAxYVFkVng3WXJJSVp2WEgwNWQ5UT09IiwibWFjIjoiYjBjNjQ0NTBiN2VmZTgzMTE3NzYxMTcxNDQwNWJmMmI0MjNjNGE4MTc5OGZlNGVjMjg4ZTk2YzI2NjQ2NzQ1ZSJ9&amp;section=search" class="department-switch " data-depid="72">
                            ООО «Тюменское экологическое объединение»
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/68/big-debtors/page?token=eyJpdiI6Ilk4NEZDTkJzb0dOUUwxWmNZaEJ4b0E9PSIsInZhbHVlIjoibUlwenZYUkI0ZUlkbHgrZjJYUEtvUT09IiwibWFjIjoiMjdiZTcyNzJkNjY0ODQ2ZjEwZDc0OTg4YjFlZDNiMmRhNjI5NmJjYTQ3M2E1NzhhZDkzODBmNDc1MjUzY2VkMCJ9&amp;section=search" class="department-switch " data-depid="68">
                            ООО «Тюменское экологическое объединение» (ТРИЦ)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/57/big-debtors/page?token=eyJpdiI6IkVmXC8rRnkyWGtnQ29oXC9tOFJcLzF3cHc9PSIsInZhbHVlIjoiNHZMZGRjSUsxaCtPaUtybGIyV2dFUT09IiwibWFjIjoiNGI4YjRlNjc0Y2IyYmVlYjdjNTBkZWU1Zjg5NDI0MzAyOWY2ODhlMWMzY2UyZWRlNzMzZTVhZWIzZmM4YzkxYyJ9&amp;section=search" class="department-switch " data-depid="57">
                            ООО УК "Гармония"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/64/big-debtors/page?token=eyJpdiI6InJ6dUFZZTQwdFRaUzNab0l2alREc3c9PSIsInZhbHVlIjoickZCNStmVzFNM1lRQ3FNRVZOSzlzQT09IiwibWFjIjoiZTU0ZmYwNjVlZTNjMDVlZjU0NDk4NmQ4ZjE4ZTY0NTg1NWJjMTllMWZiZDZlYWI1YmE3ZTNmNDY3ZjRlNzI3OSJ9&amp;section=search" class="department-switch " data-depid="64">
                            ООО УК "ЖКХ"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/50/big-debtors/page?token=eyJpdiI6Imw5SGlVZ08rZ21yaldvaSt2YXBSWkE9PSIsInZhbHVlIjoiZjRuZEtjVG5qSk9YOE9lRnM5Z2lwUT09IiwibWFjIjoiZDRmNjgxOGM4MjI2ODFiMmI1ZTFlZDAyN2Q2MTdiNjQ5MWI1MjViMDU5MDg0MjNhMTlkZDk4YjExMmVmM2IwYyJ9&amp;section=search" class="department-switch " data-depid="50">
                            ООО УК «Запад» (жил.фонд)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/41/big-debtors/page?token=eyJpdiI6Ik84MkZCRGFlc3NpQkVEXC9GS3A5YnJnPT0iLCJ2YWx1ZSI6IklRRnJReDhnMHBJekd4c1wvaGNXeTNRPT0iLCJtYWMiOiIzYzk5MzE2YzcxN2VlNTc0NjI1OTExMDg5NDUwMDc2YWU3YzY2YWUxZDI2NmEwOTQ0OGY4MmQ1OGU2NzQwOTY2In0%3D&amp;section=search" class="department-switch " data-depid="41">
                            РИЦ
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/19/big-debtors/page?token=eyJpdiI6InB1ZWN4aVFmWnpIek91SFdoWGJPcEE9PSIsInZhbHVlIjoidmxuZ212QW16dU1tZzR4WTZ2YUxodz09IiwibWFjIjoiYjMyYjBmMjJhYzkwMDQ3NjY3ZDZhZmFhYTIzZmQ5ZDk0MjdiMzE5YTliNjA4NTAxNmRmOTNlZThlODI4MmE5NiJ9&amp;section=search" class="department-switch " data-depid="19">
                            Тобольское управление
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/53/big-debtors/page?token=eyJpdiI6IkRPamRsenVlSVJtQ1wvUzhlNWtkWldRPT0iLCJ2YWx1ZSI6IkYydTRmNVwvRGU3ZHc2bFwvZ0RCVzhSZz09IiwibWFjIjoiN2Q2NmFmMGI3NTI2M2M0MjUwOGVmMjZiMDUzMTA1ODg3MDA2YmY4NmY1YmY0YjlmMWEyNTVkY2M1MjEzNWVlNiJ9&amp;section=search" class="department-switch " data-depid="53">
                            ТСЖ "Шанс"
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/54/big-debtors/page?token=eyJpdiI6ImNyTWlDUHFwUU1MaDNYc3p2R21nVkE9PSIsInZhbHVlIjoiU2c3RnpOdTF0aWNZKzZUa0RHaDBDZz09IiwibWFjIjoiZGFjNGNjMGI4OGRkZDEyMzMxMzVhMTc3NThkZmQ3NGI1MWQxNTRkMmJmMjdhYTkwMTg3N2VkNzBjZTc1YTA1NSJ9&amp;section=search" class="department-switch " data-depid="54">
                            ТСЖ «Утешево»
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/11/big-debtors/page?token=eyJpdiI6Ijh1ZDNHSlZPRzhhcnNCUDZKd0M4XC9nPT0iLCJ2YWx1ZSI6IlBMWFIyN1hZdW9pOEt3dUw4bmdvR0E9PSIsIm1hYyI6Ijk1ZThhNzRmYTNjNTkyOTk1NTkwZTE2YTZkYjM0ZDI2NDBhMjM3MzczNGMwZTZjNWZhNGNjNjkwZGNmYjlkNDQifQ%3D%3D&amp;section=search" class="department-switch " data-depid="11">
                            Тюмень
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/66/big-debtors/page?token=eyJpdiI6InJZekFwcnZGczFFblB5dlJwQnZvMGc9PSIsInZhbHVlIjoiZXlQa1d2VWF6XC9tWk05OXhcL283SmpnPT0iLCJtYWMiOiJhYTAzY2RjYzhiNmFlM2ZmMmRmNzQ1ZjFjODE5MDQyODRhNTVlZmNhOTI4MzZiM2Q1YzEzZmMzYzJkMWI0ZThkIn0%3D&amp;section=search" class="department-switch " data-depid="66">
                            Тюмень и Тюменский участок (АСРН)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/83/big-debtors/page?token=eyJpdiI6IlJuMnYwU0xBdXNHdGV1RVwvbUhaU1N3PT0iLCJ2YWx1ZSI6IllaSExhMFp6dDR2dERUbnhUWHdGT1E9PSIsIm1hYyI6IjBhZDRiNTVhNDJmMzI0ODc2MzZjNjMyMGFkZGQ0ZDY0YzliNjRmN2U1ZGRmNzFjNzQ4YjQ0MDc3MDFlMmVmMTkifQ%3D%3D&amp;section=search" class="department-switch " data-depid="83">
                            Филиал АО "ЕРИЦ ЯНАО" в г. Новый Уренгой
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/6/big-debtors/page?token=eyJpdiI6IlwvV3daMk41U0ZFMDVwQzhYcXB3OEh3PT0iLCJ2YWx1ZSI6IlNETlJaS2Z1ZDlHMHlYd0VFUWJ4QUE9PSIsIm1hYyI6ImJhNzFmNDYxZjEzYmEzNDBjZThmMzhhYTdlODJlYjZiYTM0ZjE4OTk1MmE0YzhmYjAyZDU4MzNmMGJjNTBlOGEifQ%3D%3D&amp;section=search" class="department-switch active" data-depid="6">
                            Филиал АО "ЕРИЦ ЯНАО" в г. Ноябрьск
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/36/big-debtors/page?token=eyJpdiI6Ik1MXC9oWjg4cEQzWFpHamZCSUVJNEFnPT0iLCJ2YWx1ZSI6IjcyZHRleHNqQWRSMU1rdXpTVzlLY3c9PSIsIm1hYyI6IjEzOGY0NDRlOWU1YzBlOTdmMTRhODZhYjA0NmZlZTc0NTY0MTFmYmYzZTBkNGZkODM3YTQ1MmIzZWVlZWUzZWYifQ%3D%3D&amp;section=search" class="department-switch " data-depid="36">
                            Филиал АО "ЕРИЦ ЯНАО" в Газ-Сале
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/34/big-debtors/page?token=eyJpdiI6IjJpSEpZcjFjZ1pMQ0lYeTZWSmZHaXc9PSIsInZhbHVlIjoiZXJSbzRsZ3VNMG1sM2dENURraWJsdz09IiwibWFjIjoiMDZlYzMwODQwNTc3YWM4YTZjMjc1NWVhYjBlN2UzZWQ0OTg3NTcxZjJhZDBkNGUzY2FjZTVhNTUzODY0ZjQyOCJ9&amp;section=search" class="department-switch " data-depid="34">
                            Филиал АО "ЕРИЦ ЯНАО" в городе Губкинский
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/32/big-debtors/page?token=eyJpdiI6ImtaM0w1WE9rNkF2XC84cXBhZ005S1ZBPT0iLCJ2YWx1ZSI6InMrb2wrZ3dzd2hBMDhEdjNuWUc1d3c9PSIsIm1hYyI6ImI0OGM3NjQ5ZmE4MzUzMTRlOGViOWE5NmExZThiZTRjZTc0OWZjODE1MTMzZjkzMjZiN2FjZDg1MTk4ZjA5YTUifQ%3D%3D&amp;section=search" class="department-switch " data-depid="32">
                            Филиал АО "ЕРИЦ ЯНАО" в городе Лабытнанги
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/28/big-debtors/page?token=eyJpdiI6IldwaDlFcUhKZUttWnhqZkY0bXdCaVE9PSIsInZhbHVlIjoiWHMyYXFTM2s4T1hqbEUydjVXdkJWdz09IiwibWFjIjoiNjNiYTkwMTgzYjE1MDI0NTM1ZjNiMmMwZDU3OGNlMTk0ZWViYzliZmRhMGI2OWRiM2M4NTQ0MDBjZDBhNWUyMCJ9&amp;section=search" class="department-switch " data-depid="28">
                            Филиал АО "ЕРИЦ ЯНАО" в городе Муравленко
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/29/big-debtors/page?token=eyJpdiI6ImpcL2RFd044UlwvWDZYTDdRdHNFTHpMQT09IiwidmFsdWUiOiJCbys5T0Y3bHBMMmFLdXl0UEdCaDNnPT0iLCJtYWMiOiI1MGZhOGZiYWE1ZmRkNmM5ZDQyZGZkOGMzMmIyZDlhZTkwNTQ3NmFkMjBkNTZmMDQxZGJjN2ViNzg2Yjg0M2MwIn0%3D&amp;section=search" class="department-switch " data-depid="29">
                            Филиал АО "ЕРИЦ ЯНАО" в городе Салехарде
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/56/big-debtors/page?token=eyJpdiI6IjdXK25oM09xVjVKWFV6dDVcLzRoM0hRPT0iLCJ2YWx1ZSI6InQxb3IxaHdBMTdLejhBYTlqdDNsTVE9PSIsIm1hYyI6ImE5YzlhOTcyMTYwYjY5NDYyYzBhMTFhNjdiNDEzMzU5NjVkYTIxMDVkZDJlNjRiM2NhNWMwNGUwZDkxYjA3NTYifQ%3D%3D&amp;section=search" class="department-switch " data-depid="56">
                            Филиал АО "ЕРИЦ ЯНАО" в Красноселькупе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/27/big-debtors/page?token=eyJpdiI6Im9iVG9WTjZaYkZ3XC9LXC9TQ2NzQ3RLQT09IiwidmFsdWUiOiIyVDJYbXk2VzBBWGg2RWJzY214YzdnPT0iLCJtYWMiOiJlMjE4NmIyZTU0NWJiZjM5YmIzZGEwM2IwNjg5ZmIxZDUzNjUwMTE1MTRmY2Q2MDE3MTBkZTNmZjUzNjUxZDI0In0%3D&amp;section=search" class="department-switch " data-depid="27">
                            Филиал АО "ЕРИЦ ЯНАО" в Надымском районе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/30/big-debtors/page?token=eyJpdiI6IjN4T1pyZDB3UzUreTltMm5CMzNUblE9PSIsInZhbHVlIjoiSDhPVStZWmVyQ2xoV0t3VFdVbWV1UT09IiwibWFjIjoiMDNhMmFkMzgzYzc1NDM0YWRlM2FjYTc0YjNmODBlNjI3ZDhmOTU4MDM4ODNhOGNmYTYzNWMyZmRlM2E1ZWEzZSJ9&amp;section=search" class="department-switch " data-depid="30">
                            филиал АО "ЕРИЦ ЯНАО" в Приуральском районе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/31/big-debtors/page?token=eyJpdiI6ImNnRytSRDVUd2Z2UGtEQ3FQN0RIU3c9PSIsInZhbHVlIjoiYU9VSlM5V0pwS3RPSUg5ZWZVTnhMUT09IiwibWFjIjoiZThjYzAyNTE4YjhkMzM0MzgyOGM2NzNjNjk5MmM2NDMwNmE2MThmMjBiYTExOTczZjc3MGIxZmJhM2Y0MWY4YSJ9&amp;section=search" class="department-switch " data-depid="31">
                            Филиал АО "ЕРИЦ ЯНАО" в Пуровском районе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/35/big-debtors/page?token=eyJpdiI6Imtsekw0enM4eFFIMHJIcU9DT3Q4d3c9PSIsInZhbHVlIjoiaEhiUHdBTmdwNXBySHU5QmFkcUJVUT09IiwibWFjIjoiZTdmYWJhODQ3NWI4YzVjOTcyNjU5ZDYwZTFhNmFmMDIxMDM5MjA2YmQ3OGM2YTdkODU0NTdiOGNlMWNjMTQ5NSJ9&amp;section=search" class="department-switch " data-depid="35">
                            Филиал АО "ЕРИЦ ЯНАО" в Тазовском районе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/37/big-debtors/page?token=eyJpdiI6IjFDTXliWmgybm9HcjRXVVwvQ25SQmp3PT0iLCJ2YWx1ZSI6IndsbTh6azQ0UU9pVno1dktkemFXc3c9PSIsIm1hYyI6ImQwYjM1NTkyN2UxMTE0NWMyNmVhYWUzNTk4YWY5NGYxMWQwOTc4MjQwNWZmZmQ4MWIyYzQyZTcxNjIzZjdmMGYifQ%3D%3D&amp;section=search" class="department-switch " data-depid="37">
                            Филиал АО "ЕРИЦ ЯНАО" в Харпе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/33/big-debtors/page?token=eyJpdiI6IlNhZWVGUUUwdG1cL3Zsck8zT1N6QkpRPT0iLCJ2YWx1ZSI6IlFhbHRrYmEzUnpoRUtNQmxQdGFQbUE9PSIsIm1hYyI6ImZmZjMxZmY2OWJjYjA3Y2ZiZDE2ZDFhYTg0MDA5MWE3NWI4NGNkMjMyM2UxNjNjYzA2YWRmZjczODM4MGYwOWIifQ%3D%3D&amp;section=search" class="department-switch " data-depid="33">
                            Филиал АО "ЕРИЦ ЯНАО" в Шурышкарском районе
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/38/big-debtors/page?token=eyJpdiI6IjJJNGtMa1Y3YXdhcWhCak9NaDZTY0E9PSIsInZhbHVlIjoiVERhZmorQU9YSm1UZFV6b0J6dWl5dz09IiwibWFjIjoiNzVhMmJlODRmYzFiZDczMDI4YjhlZjdmOGVjZDI3ZjdhZTI4YjZkZGVmZmM2MGY2YmRmMWQwMzkzODQyMmY5NCJ9&amp;section=search" class="department-switch " data-depid="38">
                            Филиал АО "ЕРИЦ ЯНАО" в Яр-Сале
                        </a>
                    </li>
                                    <li>
                        <a href="https://81.pyramid.vostok-electra.ru/login/department/81/big-debtors/page?token=eyJpdiI6ImtmY2hOUm9TUDNLNEgyd2VGMzF2bnc9PSIsInZhbHVlIjoiV2pDU01cL3FldEpYMEhyYXk0XC9VVDVRPT0iLCJtYWMiOiI5MjQ4M2ZkZGNkMjE1NzIxZjcwMzFmNzdlNTBlNjMxMWMxNzE1ZmZjZTBkMmQ4MWY4NGI3MjY2NWUzMWQ1MDBmIn0%3D&amp;section=search" class="department-switch " data-depid="81">
                            ЧЭС
                        </a>
                    </li>
                                    <li>
                        <a href="https://kgn.pyramid.vostok-electra.ru/login/department/40/big-debtors/page?token=eyJpdiI6InF0TmdMXC9iZ3NJZWxBV1pyald3N2ZnPT0iLCJ2YWx1ZSI6IlJaSDdTa0tZUmhaYjlobVFUNllkTXc9PSIsIm1hYyI6IjQwYzMwODQwYTI5YzE3MmE2YjE2MDE1OTI1MTY0MmFjNjk0YjI0ZDM3ZTc4MDk5YzgwZDg3MDlkYTY1ZTUyM2UifQ%3D%3D&amp;section=search" class="department-switch " data-depid="40">
                            Шадринск
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/67/big-debtors/page?token=eyJpdiI6IkIzT0h5QUdaMkxSV1B0OURkTVVUQ2c9PSIsInZhbHVlIjoiMnNQSEMxVjloMW5ZV1ZhOFEzRGVydz09IiwibWFjIjoiZjk0MjIyZjI0MjBiODRiMGJkZjViNDM1ZmY2Zjg3YTJmODk1YjEwOTM2N2NhNGVkNTI5ZGRmYzcwNGExM2E4MCJ9&amp;section=search" class="department-switch " data-depid="67">
                            ЭК Восток Оренбург
                        </a>
                    </li>
                                    <li>
                        <a href="https://yuric.pyramid.vostok-electra.ru/login/department/77/big-debtors/page?token=eyJpdiI6IkcwTXFndWIyVmkxWXlRYnF6cEdLd2c9PSIsInZhbHVlIjoiZUVjWW1ZUlB3ZnJ4c3k3S3ZqUFAyUT09IiwibWFjIjoiMDRlOTNmYTcwMThiNWIyODEyNjcxNzZhMDMzOTJiMTJjOTNiNTVlZWM2MzYyNjVmNzM4YmYzNGU0ZTM5ZDUzMCJ9&amp;section=search" class="department-switch " data-depid="77">
                            Югра-Экология
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/59/big-debtors/page?token=eyJpdiI6InJSK1N1WEI4RE52ZkducVpyYlpuOEE9PSIsInZhbHVlIjoialJldStrVVwvNHdNS1RQR2t0WFNZcmc9PSIsIm1hYyI6ImYzMjMzOGI1OTM3MDUwZWIyNmYxOWJlZThkNzQxMGM2NTU3MzM4Yzk2ZTY1NzM1YTEwYjY0NzQ0MzM1MWM1MzYifQ%3D%3D&amp;section=search" class="department-switch " data-depid="59">
                            Ялуторовский (СУЭНКО)
                        </a>
                    </li>
                                    <li>
                        <a href="https://pyramid.vostok-electra.ru/login/department/12/big-debtors/page?token=eyJpdiI6Ik8zREtrUHhvbzdZbTZ2WlhaTHpRV1E9PSIsInZhbHVlIjoibGdRVnhpTktDeVRjbldDZHMyckV2UT09IiwibWFjIjoiMmQ5ODBjZmIxMmQ4NmM4MDBlZTc0OWI0YjM0MDgxYjIxNDQ1ZTY3YWZlNDlhNWZhNmVkNjA1ZGZiZDQzMWJhNSJ9&amp;section=search" class="department-switch " data-depid="12">
                            Ялуторовский участок
                        </a>
                    </li>
                
                
        </ul>
      </ul>
    </ul>